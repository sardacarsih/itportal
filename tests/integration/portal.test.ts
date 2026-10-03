import { test, expect, beforeAll } from 'bun:test';
import { rows, one, db, sql } from '../../src/lib/server/db';
import { setting } from '../../src/lib/server/config';
import {
	createTicket,
	changeTicket,
	getTicket,
	detail,
	listTickets
} from '../../src/lib/server/portal';
import {
	createSession,
	sessionUser,
	revoke,
	hashToken,
	authenticate
} from '../../src/lib/server/auth';
import { saveUser } from '../../src/lib/server/admin';
import type { User } from '../../src/lib/domain';
import { readdir } from 'node:fs/promises';
import { uploadDir } from '../../src/lib/server/config';
let requester: User, other: User, agent: User, admin: User, service: string;
if (setting('SEED_DEMO') !== 'true')
	throw new Error('Integration suite requires an isolated, fictional seed database.');
beforeAll(async () => {
	const users = await rows<Omit<User, 'teamIds'>>(
		sql`SELECT id,name,email,role,department FROM users WHERE email IN ('pemohon@example.test','pemohon-lain@example.test','agen@example.test','admin@example.test')`
	);
	for (const u of users) {
		const ms = await rows<{ team_id: string }>(
			sql`SELECT team_id FROM memberships WHERE user_id=${u.id}::uuid`
		);
		const full = { ...u, teamIds: ms.map((m) => m.team_id) };
		if (u.email === 'pemohon@example.test') requester = full;
		if (u.email === 'pemohon-lain@example.test') other = full;
		if (u.role === 'AGEN') agent = full;
		if (u.role === 'ADMIN') admin = full;
	}
	service = (await one<{ id: string }>(sql`SELECT id FROM services WHERE name='Infrastructure'`))!
		.id;
});
const input = () => ({
	key: crypto.randomUUID(),
	service,
	subject: 'Integration test ' + crypto.randomUUID().slice(0, 8),
	description: 'Fictional test description with sufficient context.',
	kind: 'INCIDENT' as const,
	impact: 1,
	urgency: 2
});
async function ticket() {
	return createTicket(requester, input(), []);
}
test('atomic creation and concurrent duplicate retries produce one ticket and event', async () => {
	const data = input();
	const ids = await Promise.all([
		createTicket(requester, data, []),
		createTicket(requester, data, []),
		createTicket(requester, data, [])
	]);
	expect(new Set(ids).size).toBe(1);
	const events = await rows(sql`SELECT id FROM ticket_events WHERE ticket_id=${ids[0]}::uuid`);
	expect(events).toHaveLength(1);
	expect((await getTicket(requester, ids[0])).number).toMatch(/^IT-\d{4}-\d{6,}$/);
});
test('guessed IDs and unauthorized team records denied', async () => {
	const id = await ticket();
	await expect(getTicket(other, id)).rejects.toThrow('tidak ditemukan');
	await expect(getTicket({ ...agent, id: other.id, teamIds: [] }, id)).rejects.toThrow();
	expect((await getTicket(admin, id)).id).toBe(id);
	const filtered = await listTickets(other, new URLSearchParams());
	expect(filtered.tickets.some((t) => t.id === id)).toBe(false);
});
test('internal notes excluded from requester detail, activity and notifications', async () => {
	const id = await ticket();
	await changeTicket(agent, id, 1, { type: 'reply', body: 'PRIVATE-' + id, internal: true });
	const visible = await detail(requester, id);
	expect(JSON.stringify(visible)).not.toContain('PRIVATE-');
	expect(visible.messages).toHaveLength(0);
	expect(visible.activity).toHaveLength(1);
	expect((await detail(agent, id)).messages[0].body).toBe('PRIVATE-' + id);
	expect(await rows(sql`SELECT * FROM notifications WHERE ticket_id=${id}::uuid`)).toHaveLength(0);
	await expect(
		changeTicket(requester, id, 2, { type: 'reply', body: 'forged note', internal: true })
	).rejects.toThrow();
});
test('concurrent updates reject stale version and keep atomic event history', async () => {
	const id = await ticket();
	const outcomes = await Promise.allSettled([
		changeTicket(agent, id, 1, { type: 'status', status: 'DIPROSES', note: '' }),
		changeTicket(agent, id, 1, { type: 'status', status: 'SELESAI', note: 'Resolution test note.' })
	]);
	expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
	expect((await getTicket(agent, id)).version).toBe(2);
	expect(await rows(sql`SELECT * FROM ticket_events WHERE ticket_id=${id}::uuid`)).toHaveLength(2);
});
test('requester reply resumes clock; other comments and internal notes leave status unchanged', async () => {
	const id = await ticket();
	await changeTicket(agent, id, 1, { type: 'status', status: 'DIPROSES', note: '' });
	await changeTicket(agent, id, 2, {
		type: 'status',
		status: 'MENUNGGU_PEMOHON',
		note: 'Need details'
	});
	const paused = await getTicket(requester, id);
	expect(paused.resolution_due).toBeNull();
	const responseDue = new Date(paused.response_due).getTime();
	await changeTicket(agent, id, 3, {
		type: 'reply',
		body: 'Internal investigation',
		internal: true
	});
	await changeTicket(agent, id, 4, { type: 'reply', body: 'Please send details', internal: false });
	expect((await getTicket(requester, id)).status).toBe('MENUNGGU_PEMOHON');
	await changeTicket(requester, id, 5, {
		type: 'reply',
		body: 'Here are the details',
		internal: false
	});
	const resumed = await getTicket(requester, id);
	expect(resumed.status).toBe('DIPROSES');
	expect(resumed.resolution_due).not.toBeNull();
	expect(new Date(resumed.response_due).getTime()).toBe(responseDue);
});
test('resolve requires note, then requester can reopen, close; terminal actions fail', async () => {
	const id = await ticket();
	await expect(
		changeTicket(agent, id, 1, { type: 'status', status: 'SELESAI', note: '' })
	).rejects.toThrow('Catatan');
	await changeTicket(agent, id, 1, {
		type: 'status',
		status: 'SELESAI',
		note: 'Fixed the fictional configuration.'
	});
	await changeTicket(requester, id, 2, {
		type: 'status',
		status: 'DIPROSES',
		note: 'Still failing'
	});
	await changeTicket(agent, id, 3, {
		type: 'status',
		status: 'SELESAI',
		note: 'Second resolution verified.'
	});
	await changeTicket(requester, id, 4, { type: 'status', status: 'DITUTUP', note: '' });
	await expect(
		changeTicket(admin, id, 5, { type: 'reply', body: 'Cannot change', internal: false })
	).rejects.toThrow('terminal');
	const related = await createTicket(requester, { ...input(), related: id }, []);
	expect((await getTicket(requester, related)).related_id).toBe(id);
});
test('assignment validates team and notification access', async () => {
	const id = await ticket();
	await changeTicket(agent, id, 1, {
		type: 'assign',
		agent: agent.id,
		team:
			agent.teamIds[0] === (await getTicket(agent, id)).team_id
				? agent.teamIds[0]
				: (await getTicket(agent, id)).team_id
	});
	const notifications = await rows<{ user_id: string }>(
		sql`SELECT user_id FROM notifications WHERE ticket_id=${id}::uuid`
	);
	expect(notifications.some((n) => n.user_id === other.id)).toBe(false);
	await expect(
		changeTicket(requester, id, 2, { type: 'assign', agent: agent.id, team: agent.teamIds[0] })
	).rejects.toThrow();
});
test('failed ticket creation compensates files and metadata', async () => {
	const before = await readdir(uploadDir).catch(() => []);
	await expect(
		createTicket(requester, { ...input(), service: crypto.randomUUID() }, [
			new File(['error log'], 'log.txt', { type: 'text/plain' })
		])
	).rejects.toThrow('Layanan');
	const after = await readdir(uploadDir);
	expect(after.filter((n) => n !== '.staging').sort()).toEqual(
		before.filter((n) => n !== '.staging').sort()
	);
	expect(await readdir(uploadDir + '/.staging')).toHaveLength(0);
});
test('append-only event history enforced by database', async () => {
	const id = await ticket();
	await expect(
		Promise.resolve(
			db.execute(sql`UPDATE ticket_events SET detail='forged' WHERE ticket_id=${id}::uuid`)
		)
	).rejects.toThrow();
});
test('session token hashed, rotated, expired and revoked', async () => {
	const token = await createSession(requester.id);
	expect((await sessionUser(token))?.id).toBe(requester.id);
	expect(await one(sql`SELECT * FROM sessions WHERE token_hash=${token}`)).toBeUndefined();
	const rotated = await createSession(requester.id, token);
	expect(await sessionUser(token)).toBeNull();
	await db.execute(
		sql`UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=${hashToken(rotated)}`
	);
	expect(await sessionUser(rotated)).toBeNull();
	const final = await createSession(requester.id);
	await revoke(final);
	expect(await sessionUser(final)).toBeNull();
});
test('deactivation revokes sessions and preserves history; last admin protected', async () => {
	const email = 'test-' + crypto.randomUUID() + '@example.test';
	const id = await saveUser({
		name: 'Fictional test user',
		email,
		department: 'Test',
		role: 'PEMOHON',
		active: true,
		teams: [],
		password: crypto.randomUUID()
	});
	const token = await createSession(id!);
	await saveUser({
		id: id!,
		name: 'Fictional test user',
		email,
		department: 'Test',
		role: 'PEMOHON',
		active: false,
		teams: []
	});
	expect(await sessionUser(token)).toBeNull();
	await expect(saveUser({ ...admin, id: admin.id, active: false, teams: [] })).rejects.toThrow(
		'terakhir'
	);
});
test('login succeeds with environment password and rate limit rejects repeated guesses', async () => {
	expect(
		(
			await authenticate(
				requester.email,
				setting('SEED_REQUESTER_PASSWORD')!,
				'test-' + crypto.randomUUID()
			)
		).user?.id
	).toBe(requester.id);
	const email = 'limit-' + crypto.randomUUID() + '@example.test';
	const ip = crypto.randomUUID();
	for (let i = 0; i < 10; i++) expect((await authenticate(email, 'wrong', ip)).limited).toBe(false);
	expect((await authenticate(email, 'wrong', ip)).limited).toBe(true);
});

test('ticket numbers expand past six digits without truncation', async () => {
	const { client } = await import('../../src/lib/server/db');
	const previous = await client`SELECT last_value FROM ticket_number_seq`;
	const boundary = 1000000 + Number(previous[0].last_value) + 1;
	await client`SELECT setval('ticket_number_seq',${boundary},false)`;
	try {
		const id = await ticket();
		expect((await getTicket(requester, id)).number).toEndWith('-' + boundary);
	} finally {
		await client`SELECT setval('ticket_number_seq',${Number(previous[0].last_value)},true)`;
	}
});
