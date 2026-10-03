import { test, expect } from 'bun:test';
import {
	canSee,
	canHandle,
	transitionAllowed,
	priorityFor,
	clockChange,
	statuses,
	type User,
	type Ticket
} from '../../src/lib/domain';
const requester: User = {
	id: 'r',
	name: 'R',
	email: 'r@example.test',
	department: '',
	role: 'PEMOHON',
	teamIds: []
};
const agent: User = { ...requester, id: 'a', role: 'AGEN', teamIds: ['t'] };
const admin: User = { ...requester, id: 'admin', role: 'ADMIN' };
const ticket = { requester_id: 'r', team_id: 't', status: 'BARU' } as Ticket;
test('requester sees only own records; team membership cannot elevate requester', () => {
	expect(canSee(requester, ticket)).toBe(true);
	expect(canSee({ ...requester, id: 'other', teamIds: ['t'] }, ticket)).toBe(false);
	expect(canHandle(requester, ticket)).toBe(false);
});
test('agent sees only assigned teams; admin has full access', () => {
	expect(canSee(agent, ticket)).toBe(true);
	expect(canSee({ ...agent, teamIds: [] }, ticket)).toBe(false);
	expect(canSee(admin, ticket)).toBe(true);
});
for (const [impact, urgency, expected] of [
	[1, 1, 'P4'],
	[1, 2, 'P3'],
	[1, 3, 'P2'],
	[2, 1, 'P3'],
	[2, 2, 'P2'],
	[2, 3, 'P1'],
	[3, 1, 'P2'],
	[3, 2, 'P1'],
	[3, 3, 'P1']
] as const)
	test(`priority ${impact} x ${urgency}`, () =>
		expect(priorityFor(impact, urgency)).toBe(expected));
test('custom priority mapping validates result', () => {
	expect(priorityFor(1, 1, { '1:1': 'P2' })).toBe('P2');
	expect(() => priorityFor(4, 1)).toThrow();
});
test('agent legal lifecycle and forbidden jumps', () => {
	expect(transitionAllowed(agent, ticket, 'DIPROSES')).toBe(true);
	expect(transitionAllowed(agent, ticket, 'SELESAI')).toBe(true);
	expect(transitionAllowed(agent, ticket, 'DITUTUP')).toBe(false);
	expect(transitionAllowed(agent, { ...ticket, status: 'DIPROSES' }, 'MENUNGGU_PEMOHON')).toBe(
		true
	);
	expect(transitionAllowed(agent, { ...ticket, status: 'MENUNGGU_PEMOHON' }, 'SELESAI')).toBe(
		false
	);
});
test('requester resolves confirmation, reopening and cancellation permissions', () => {
	expect(transitionAllowed(requester, ticket, 'DIBATALKAN')).toBe(true);
	expect(transitionAllowed(agent, ticket, 'DIBATALKAN')).toBe(false);
	expect(transitionAllowed(requester, { ...ticket, status: 'SELESAI' }, 'DITUTUP')).toBe(true);
	expect(transitionAllowed(requester, { ...ticket, status: 'SELESAI' }, 'DIPROSES')).toBe(true);
	expect(transitionAllowed(requester, ticket, 'SELESAI')).toBe(false);
});
for (const status of ['DITUTUP', 'DIBATALKAN'] as const)
	test(`${status} terminal for all roles`, () => {
		for (const user of [requester, agent, admin])
			for (const next of statuses)
				expect(transitionAllowed(user, { ...ticket, status }, next)).toBe(false);
	});
test('waiting pauses resolution time and preserves overdue duration', () => {
	const now = new Date('2026-01-01T01:00:00Z');
	const paused = clockChange(
		{
			status: 'DIPROSES',
			resolution_due: new Date('2026-01-01T02:00:00Z'),
			resolution_remaining_ms: 999
		},
		'MENUNGGU_PEMOHON',
		now
	);
	expect(paused.due).toBeNull();
	expect(paused.remaining).toBe(3600000);
	const resumed = clockChange(
		{ status: 'MENUNGGU_PEMOHON', resolution_due: null, resolution_remaining_ms: paused.remaining },
		'DIPROSES',
		new Date('2026-01-02T00:00:00Z')
	);
	expect(resumed.due?.toISOString()).toBe('2026-01-02T01:00:00.000Z');
	expect(
		clockChange(
			{
				status: 'DIPROSES',
				resolution_due: new Date('2026-01-01T00:00:00Z'),
				resolution_remaining_ms: 0
			},
			'MENUNGGU_PEMOHON',
			now
		).remaining
	).toBe(-3600000);
});
