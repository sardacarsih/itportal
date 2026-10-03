export const statuses = [
	'BARU',
	'DIPROSES',
	'MENUNGGU_PEMOHON',
	'SELESAI',
	'DITUTUP',
	'DIBATALKAN'
] as const;
export type Status = (typeof statuses)[number];
export type Role = 'PEMOHON' | 'AGEN' | 'ADMIN';
export const labels: Record<string, string> = {
	BARU: 'Baru',
	DIPROSES: 'Diproses',
	MENUNGGU_PEMOHON: 'Menunggu pemohon',
	SELESAI: 'Selesai',
	DITUTUP: 'Ditutup',
	DIBATALKAN: 'Dibatalkan',
	PEMOHON: 'Pemohon',
	AGEN: 'Agen IT',
	ADMIN: 'Admin',
	INCIDENT: 'Insiden',
	REQUEST: 'Permintaan layanan',
	P1: 'P1 · Kritis',
	P2: 'P2 · Tinggi',
	P3: 'P3 · Normal',
	P4: 'P4 · Rendah'
};
export interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
	department: string;
	teamIds: string[];
}
export interface Ticket {
	id: string;
	number: string;
	requester_id: string;
	team_id: string;
	agent_id: string | null;
	service_id: string;
	subject: string;
	description: string;
	status: Status;
	priority: string;
	kind: string;
	impact: number;
	urgency: number;
	version: number;
	resolution: string | null;
	created_at: Date;
	updated_at: Date;
	first_response_at: Date | null;
	response_due: Date;
	resolution_due: Date | null;
	resolution_remaining_ms: number;
	paused_at: Date | null;
	service_name: string;
	team_name: string;
	requester_name: string;
	agent_name: string | null;
	related_id: string | null;
}
export function canSee(user: User, ticket: Pick<Ticket, 'requester_id' | 'team_id'>) {
	return (
		user.role === 'ADMIN' ||
		(user.role === 'PEMOHON'
			? ticket.requester_id === user.id
			: user.teamIds.includes(ticket.team_id))
	);
}
export function canHandle(user: User, ticket: Pick<Ticket, 'requester_id' | 'team_id'>) {
	return user.role !== 'PEMOHON' && canSee(user, ticket);
}
export function transitionAllowed(user: User, ticket: Ticket, next: Status) {
	if (!canSee(user, ticket)) return false;
	if (next === 'DIBATALKAN')
		return ticket.status === 'BARU' && (user.role === 'ADMIN' || ticket.requester_id === user.id);
	if (
		ticket.requester_id === user.id &&
		ticket.status === 'SELESAI' &&
		['DITUTUP', 'DIPROSES'].includes(next)
	)
		return true;
	if (!canHandle(user, ticket)) return false;
	return (
		(ticket.status === 'BARU' && ['DIPROSES', 'SELESAI'].includes(next)) ||
		(ticket.status === 'DIPROSES' && ['MENUNGGU_PEMOHON', 'SELESAI'].includes(next))
	);
}
export const defaultPriorityMap = {
	'1:1': 'P4',
	'1:2': 'P3',
	'1:3': 'P2',
	'2:1': 'P3',
	'2:2': 'P2',
	'2:3': 'P1',
	'3:1': 'P2',
	'3:2': 'P1',
	'3:3': 'P1'
};
export function priorityFor(
	impact: number,
	urgency: number,
	map: Record<string, string> = defaultPriorityMap
) {
	const p = map[`${impact}:${urgency}`];
	if (!/^P[1-4]$/.test(p ?? '')) throw new Error('Pemetaan prioritas tidak valid.');
	return p;
}
export function clockChange(
	ticket: Pick<Ticket, 'status' | 'resolution_due' | 'resolution_remaining_ms'>,
	next: Status,
	now: Date
) {
	if (next === 'MENUNGGU_PEMOHON')
		return {
			due: null,
			remaining: Number(
				ticket.resolution_due
					? new Date(ticket.resolution_due).getTime() - now.getTime()
					: ticket.resolution_remaining_ms
			),
			paused: now
		};
	if (ticket.status === 'MENUNGGU_PEMOHON' || (ticket.status === 'SELESAI' && next === 'DIPROSES'))
		return {
			due: new Date(now.getTime() + Number(ticket.resolution_remaining_ms)),
			remaining: Number(ticket.resolution_remaining_ms),
			paused: null
		};
	if (['SELESAI', 'DITUTUP', 'DIBATALKAN'].includes(next))
		return {
			due: null,
			remaining: ticket.resolution_due
				? new Date(ticket.resolution_due).getTime() - now.getTime()
				: Number(ticket.resolution_remaining_ms),
			paused: null
		};
	return {
		due: ticket.resolution_due,
		remaining: Number(ticket.resolution_remaining_ms),
		paused: null
	};
}
export function date(value: Date | string | null | undefined) {
	return value
		? new Intl.DateTimeFormat('id-ID', {
				dateStyle: 'medium',
				timeStyle: 'short',
				timeZone: 'Asia/Jakarta'
			}).format(new Date(value))
		: '—';
}
