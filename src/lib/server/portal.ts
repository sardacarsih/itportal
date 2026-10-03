import { db, sql, rows, one, type Executor } from './db';
import {
	canSee,
	canHandle,
	transitionAllowed,
	clockChange,
	priorityFor,
	labels,
	type Ticket,
	type User,
	type Status
} from '../domain';
import { PortalError, ticketInput } from './validation';
import { stageUploads, publish, cleanup } from './uploads';
import type { z } from 'zod';
export interface Service {
	id: string;
	name: string;
	description: string;
	kind: string;
	team_id: string;
	team_name: string;
	active: boolean;
}
export interface Article {
	id: string;
	slug: string;
	title: string;
	body: string;
	service_id: string;
	service_name: string;
	published: boolean;
	updated_at: Date;
}
export interface Message {
	id: string;
	body: string;
	internal: boolean;
	author_name: string;
	created_at: Date;
}
export interface Attachment {
	id: string;
	name: string;
	mime: string;
	size: number;
	storage_name: string;
}
export interface Activity {
	id: string;
	kind: string;
	detail: string;
	actor_name: string;
	created_at: Date;
	internal: boolean;
}
export function scope(user: User) {
	if (user.role === 'ADMIN') return sql`true`;
	if (user.role === 'PEMOHON') return sql`t.requester_id=${user.id}::uuid`;
	return sql`t.team_id IN (SELECT team_id FROM memberships WHERE user_id=${user.id}::uuid)`;
}
const ticketSelect = sql`SELECT t.*,s.name AS service_name,tm.name AS team_name,u.name AS requester_name,a.name AS agent_name FROM tickets t JOIN services s ON s.id=t.service_id JOIN teams tm ON tm.id=t.team_id JOIN users u ON u.id=t.requester_id LEFT JOIN users a ON a.id=t.agent_id`;
export async function getTicket(user: User, id: string, executor: Executor = db) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PortalError(404, 'Tiket tidak ditemukan.');
	const t = await one<Ticket>(
		sql`${ticketSelect} WHERE t.id=${id}::uuid AND ${scope(user)}`,
		executor
	);
	if (!t) throw new PortalError(404, 'Tiket tidak ditemukan.');
	return t;
}
export async function listTickets(user: User, params: URLSearchParams) {
	const conditions = [scope(user)];
	if (params.get('active') === '1')
		conditions.push(sql`t.status IN ('BARU','DIPROSES','MENUNGGU_PEMOHON')`);
	const q = (params.get('q') || '').slice(0, 100);
	if (q)
		conditions.push(sql`(t.subject ILIKE ${'%' + q + '%'} OR t.number ILIKE ${'%' + q + '%'})`);
	const status = params.get('status');
	if (status && Object.keys(labels).includes(status))
		conditions.push(sql`t.status::text=${status}`);
	const service = params.get('service');
	if (service && /^[0-9a-f-]{36}$/i.test(service))
		conditions.push(sql`t.service_id=${service}::uuid`);
	const priority = params.get('priority');
	if (/^P[1-4]$/.test(priority || '')) conditions.push(sql`t.priority=${priority}`);
	const assignment = params.get('assignment');
	if (assignment === 'unassigned') conditions.push(sql`t.agent_id IS NULL`);
	if (assignment === 'mine') conditions.push(sql`t.agent_id=${user.id}::uuid`);
	if (params.get('overdue') === '1')
		conditions.push(
			sql`(t.resolution_due<now() OR (t.first_response_at IS NULL AND t.response_due<now())) AND t.status NOT IN ('SELESAI','DITUTUP','DIBATALKAN')`
		);
	const where = sql.join(conditions, sql` AND `);
	const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
	const size = 12;
	const count = await one<{ count: number }>(
		sql`SELECT count(*)::int AS count FROM tickets t WHERE ${where}`
	);
	const tickets = await rows<Ticket>(
		sql`${ticketSelect} WHERE ${where} ORDER BY t.created_at DESC,t.id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`
	);
	return { tickets, total: Number(count?.count || 0), page, pageSize: size };
}
export async function services(all = false) {
	return rows<Service>(
		sql`SELECT s.*,t.name AS team_name FROM services s JOIN teams t ON t.id=s.team_id WHERE ${all ? sql`true` : sql`s.active=true`} ORDER BY s.name`
	);
}
export async function articles(params: URLSearchParams, admin = false) {
	const q = (params.get('q') || '').slice(0, 100);
	const service = params.get('service');
	return rows<Article>(
		sql`SELECT a.*,s.name AS service_name FROM articles a JOIN services s ON s.id=a.service_id WHERE ${admin ? sql`true` : sql`a.published=true`} AND (a.title ILIKE ${'%' + q + '%'} OR a.body ILIKE ${'%' + q + '%'}) ${service && /^[0-9a-f-]{36}$/i.test(service) ? sql`AND a.service_id=${service}::uuid` : sql``} ORDER BY a.updated_at DESC LIMIT 100`
	);
}
export async function detail(user: User, id: string) {
	const ticket = await getTicket(user, id);
	const privateAllowed = canHandle(user, ticket);
	const [messages, attachments, activity, agents] = await Promise.all([
		rows<Message>(
			sql`SELECT m.id,m.body,m.internal,m.created_at,u.name AS author_name FROM messages m JOIN users u ON u.id=m.author_id WHERE m.ticket_id=${id}::uuid AND ${privateAllowed ? sql`true` : sql`m.internal=false`} ORDER BY m.created_at,m.id`
		),
		rows<Attachment>(
			sql`SELECT id,name,mime,size FROM attachments WHERE ticket_id=${id}::uuid ORDER BY created_at`
		),
		rows<Activity>(
			sql`SELECT e.id,e.kind,e.detail,e.internal,e.created_at,u.name AS actor_name FROM ticket_events e JOIN users u ON u.id=e.actor_id WHERE ticket_id=${id}::uuid AND ${privateAllowed ? sql`true` : sql`e.internal=false`} ORDER BY e.created_at,e.id`
		),
		privateAllowed
			? rows<{ id: string; name: string }>(
					sql`SELECT DISTINCT u.id,u.name FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE u.active AND (u.role='ADMIN' OR (u.role='AGEN' AND m.team_id=${ticket.team_id}::uuid)) ORDER BY u.name`
				)
			: Promise.resolve([])
	]);
	return { ticket, messages, attachments, activity, agents, canHandle: privateAllowed };
}
async function event(
	tx: Executor,
	ticket: string,
	user: string,
	kind: string,
	detail: string,
	internal = false
) {
	await tx.execute(
		sql`INSERT INTO ticket_events(ticket_id,actor_id,kind,detail,internal) VALUES(${ticket}::uuid,${user}::uuid,${kind},${detail},${internal})`
	);
}
async function notify(tx: Executor, t: Ticket, actor: string, body: string) {
	// Re-evaluate access for every notification recipient. Internal notes never call this.
	await tx.execute(
		sql`INSERT INTO notifications(user_id,ticket_id,body) SELECT u.id,${t.id}::uuid,${body} FROM users u WHERE u.active AND u.id<>${actor}::uuid AND (u.id=${t.requester_id}::uuid AND u.role='PEMOHON' OR u.role='ADMIN' OR (u.role='AGEN' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.team_id=${t.team_id}::uuid) AND u.id=${t.agent_id}::uuid))`
	);
}
export async function createTicket(user: User, input: z.infer<typeof ticketInput>, files: File[]) {
	const existing = await one<{ id: string }>(
		sql`SELECT id FROM tickets WHERE requester_id=${user.id}::uuid AND idempotency_key=${input.key}::uuid`
	);
	if (existing) return existing.id;
	const staged = await stageUploads(files);
	let committed = false;
	try {
		const id = await db.transaction(async (tx) => {
			// Concurrent retries serialize on this requester+key without blocking other tickets.
			await tx.execute(
				sql`SELECT pg_advisory_xact_lock(hashtextextended(${user.id + input.key},0))`
			);
			const duplicate = await one<{ id: string }>(
				sql`SELECT id FROM tickets WHERE requester_id=${user.id}::uuid AND idempotency_key=${input.key}::uuid`,
				tx
			);
			if (duplicate) return { id: duplicate.id, duplicate: true };
			const service = await one<Service>(
				sql`SELECT * FROM services WHERE id=${input.service}::uuid AND active=true FOR SHARE`,
				tx
			);
			if (!service) throw new PortalError(400, 'Layanan tidak tersedia. Pilih layanan lain.');
			if (user.role === 'AGEN' && !user.teamIds.includes(service.team_id))
				throw new PortalError(403, 'Agen hanya dapat membuat tiket untuk layanan timnya.');
			if (input.related) {
				const related = await getTicket(user, input.related, tx);
				if (related.status !== 'DITUTUP')
					throw new PortalError(400, 'Tiket terkait harus sudah ditutup.');
			}
			const mapRows = await rows<{ impact: number; urgency: number; priority: string }>(
				sql`SELECT * FROM priority_settings`,
				tx
			);
			const map = Object.fromEntries(mapRows.map((m) => [`${m.impact}:${m.urgency}`, m.priority]));
			const priority = priorityFor(input.impact, input.urgency, map);
			const target = await one<{ response_hours: number; resolution_hours: number }>(
				sql`SELECT * FROM target_settings WHERE priority=${priority}`,
				tx
			);
			if (!target) throw new PortalError(503, 'Target layanan belum dikonfigurasi.');
			const ticket = await one<Ticket>(
				sql`INSERT INTO tickets(requester_id,service_id,team_id,kind,subject,description,impact,urgency,priority,response_due,resolution_due,resolution_remaining_ms,idempotency_key,related_id) VALUES(${user.id}::uuid,${service.id}::uuid,${service.team_id}::uuid,${input.kind},${input.subject},${input.description},${input.impact},${input.urgency},${priority},now()+${target.response_hours}*interval '1 hour',now()+${target.resolution_hours}*interval '1 hour',${target.resolution_hours * 3600000},${input.key}::uuid,${input.related || null}::uuid) RETURNING *`,
				tx
			);
			if (!ticket) throw new Error('insert failed');
			for (const file of staged)
				await tx.execute(
					sql`INSERT INTO attachments(ticket_id,name,storage_name,mime,size) VALUES(${ticket.id}::uuid,${file.name},${file.storage}::uuid,${file.mime},${file.size})`
				);
			await event(tx, ticket.id, user.id, 'CREATED', 'Tiket dibuat.');
			await publish(staged);
			return { id: ticket.id, duplicate: false };
		});
		committed = true;
		if (id.duplicate) await cleanup(staged);
		return id.id;
	} catch (e) {
		if (!committed) await cleanup(staged);
		throw e;
	}
}
export async function changeTicket(
	user: User,
	id: string,
	version: number,
	action:
		| { type: 'status'; status: Status; note: string }
		| { type: 'reply'; body: string; internal: boolean }
		| { type: 'assign'; agent: string | null; team: string }
) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PortalError(404, 'Tiket tidak ditemukan.');
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT id FROM tickets WHERE id=${id}::uuid FOR UPDATE`);
		const t = await getTicket(user, id, tx);
		if (t.version !== version)
			throw new PortalError(409, 'Tiket sudah berubah. Muat ulang halaman, lalu ulangi tindakan.');
		if (['DITUTUP', 'DIBATALKAN'].includes(t.status))
			throw new PortalError(
				400,
				'Tiket terminal tidak dapat diubah. Buat tiket terkait untuk masalah lanjutan.'
			);
		let next = t.status;
		let resolution = t.resolution;
		let response = t.first_response_at;
		if (action.type === 'status') {
			if (!transitionAllowed(user, t, action.status))
				throw new PortalError(403, 'Perubahan status ini tidak diizinkan.');
			if (action.status === 'SELESAI' && action.note.trim().length < 10)
				throw new PortalError(400, 'Catatan penyelesaian minimal 10 karakter wajib diisi.');
			next = action.status;
			if (next === 'SELESAI') {
				resolution = action.note;
				if (!response) response = new Date();
			}
			await event(
				tx,
				id,
				user.id,
				'STATUS',
				`${labels[t.status]} → ${labels[next]}${action.note ? ' · ' + action.note : ''}`
			);
		} else if (action.type === 'reply') {
			if (action.internal && !canHandle(user, t))
				throw new PortalError(403, 'Catatan internal hanya untuk tim berwenang.');
			if (!action.body.trim() || action.body.length > 10000)
				throw new PortalError(400, 'Isi pesan harus 1–10.000 karakter.');
			await tx.execute(
				sql`INSERT INTO messages(ticket_id,author_id,body,internal) VALUES(${id}::uuid,${user.id}::uuid,${action.body},${action.internal})`
			);
			if (!action.internal && user.id === t.requester_id && t.status === 'MENUNGGU_PEMOHON') {
				next = 'DIPROSES';
				await event(tx, id, user.id, 'STATUS', 'Menunggu pemohon → Diproses (balasan pemohon).');
			}
			if (!action.internal && canHandle(user, t) && !response) response = new Date();
			await event(
				tx,
				id,
				user.id,
				action.internal ? 'NOTE' : 'REPLY',
				action.internal ? 'Catatan internal ditambahkan.' : 'Balasan publik ditambahkan.',
				action.internal
			);
		} else {
			if (!canHandle(user, t)) throw new PortalError(403, 'Penugasan tidak diizinkan.');
			if (action.team !== t.team_id && user.role !== 'ADMIN')
				throw new PortalError(403, 'Hanya Admin dapat memindahkan tiket antar tim.');
			const team = await one<{ id: string }>(
				sql`SELECT id FROM teams WHERE id=${action.team}::uuid`,
				tx
			);
			if (!team) throw new PortalError(400, 'Tim tidak valid.');
			if (action.agent) {
				const agent = await one(
					sql`SELECT u.id FROM users u WHERE id=${action.agent}::uuid AND active AND (role='ADMIN' OR (role='AGEN' AND EXISTS(SELECT 1 FROM memberships WHERE user_id=u.id AND team_id=${action.team}::uuid)))`,
					tx
				);
				if (!agent) throw new PortalError(400, 'Agen harus aktif dan menjadi anggota tim tiket.');
			}
			await tx.execute(
				sql`UPDATE tickets SET agent_id=${action.agent}::uuid,team_id=${action.team}::uuid WHERE id=${id}::uuid`
			);
			await event(tx, id, user.id, 'ASSIGN', 'Penugasan tim / agen diperbarui.');
			t.agent_id = action.agent;
			t.team_id = action.team;
		}
		const clock =
			next !== t.status
				? clockChange(t, next, new Date())
				: {
						due: t.resolution_due,
						remaining: Number(t.resolution_remaining_ms),
						paused: t.paused_at
					};
		await tx.execute(
			sql`UPDATE tickets SET status=${next}::ticket_status,resolution=${resolution},first_response_at=${response ? new Date(response).toISOString() : null}::timestamptz,resolution_due=${clock.due ? new Date(clock.due).toISOString() : null}::timestamptz,resolution_remaining_ms=${clock.remaining},paused_at=${clock.paused ? new Date(clock.paused).toISOString() : null}::timestamptz,updated_at=now(),version=version+1 WHERE id=${id}::uuid`
		);
		if (action.type !== 'reply' || !action.internal)
			await notify(
				tx,
				t,
				user.id,
				action.type === 'reply'
					? 'Balasan baru pada ' + t.number
					: action.type === 'assign'
						? 'Penugasan diperbarui: ' + t.number
						: `${t.number}: ${labels[next]}`
			);
	});
}
export async function dashboard(user: User) {
	const counts = await one<{
		active: number;
		waiting: number;
		resolved: number;
		unassigned: number;
		overdue: number;
	}>(
		sql`SELECT count(*) FILTER(WHERE t.status IN ('BARU','DIPROSES','MENUNGGU_PEMOHON'))::int AS active,count(*) FILTER(WHERE t.status='MENUNGGU_PEMOHON')::int AS waiting,count(*) FILTER(WHERE t.status='SELESAI')::int AS resolved,count(*) FILTER(WHERE t.agent_id IS NULL AND t.status IN ('BARU','DIPROSES','MENUNGGU_PEMOHON'))::int AS unassigned,count(*) FILTER(WHERE (t.resolution_due<now() OR (t.first_response_at IS NULL AND t.response_due<now())) AND t.status IN ('BARU','DIPROSES','MENUNGGU_PEMOHON'))::int AS overdue FROM tickets t WHERE ${scope(user)}`
	);
	const list = await listTickets(user, new URLSearchParams({ active: '1' }));
	const activity = await rows<Activity & { ticket_id: string; number: string }>(
		sql`SELECT e.id,e.kind,e.detail,e.created_at,e.ticket_id,t.number,u.name AS actor_name FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id JOIN users u ON u.id=e.actor_id WHERE ${scope(user)} AND ${user.role === 'PEMOHON' ? sql`e.internal=false` : sql`true`} ORDER BY e.created_at DESC LIMIT 6`
	);
	return { counts: counts!, tickets: list.tickets.slice(0, 6), activity };
}
