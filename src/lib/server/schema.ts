import {
	pgTable,
	pgEnum,
	uuid,
	text,
	boolean,
	integer,
	bigint,
	timestamp,
	primaryKey,
	uniqueIndex,
	index
} from 'drizzle-orm/pg-core';
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const userRole = pgEnum('user_role', ['PEMOHON', 'AGEN', 'ADMIN']);
export const ticketStatus = pgEnum('ticket_status', [
	'BARU',
	'DIPROSES',
	'MENUNGGU_PEMOHON',
	'SELESAI',
	'DITUTUP',
	'DIBATALKAN'
]);
export const users = pgTable('users', {
	id: uuid().primaryKey().defaultRandom(),
	email: text().notNull().unique(),
	name: text().notNull(),
	department: text().notNull().default(''),
	role: userRole().notNull(),
	passwordHash: text('password_hash').notNull(),
	active: boolean().notNull().default(true),
	createdAt: time('created_at').notNull().defaultNow()
});
export const teams = pgTable('teams', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique()
});
export const memberships = pgTable(
	'memberships',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id)
	},
	(t) => [primaryKey({ columns: [t.userId, t.teamId] })]
);
export const sessions = pgTable('sessions', {
	tokenHash: text('token_hash').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: time('expires_at').notNull(),
	createdAt: time('created_at').notNull().defaultNow()
});
export const services = pgTable('services', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull().unique(),
	description: text().notNull(),
	kind: text().notNull(),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id),
	active: boolean().notNull().default(true)
});
export const targetSettings = pgTable('target_settings', {
	priority: text().primaryKey(),
	responseHours: integer('response_hours').notNull(),
	resolutionHours: integer('resolution_hours').notNull()
});
export const prioritySettings = pgTable(
	'priority_settings',
	{
		impact: integer().notNull(),
		urgency: integer().notNull(),
		priority: text()
			.notNull()
			.references(() => targetSettings.priority)
	},
	(t) => [primaryKey({ columns: [t.impact, t.urgency] })]
);
export const tickets = pgTable(
	'tickets',
	{
		id: uuid().primaryKey().defaultRandom(),
		number: text().notNull().unique(),
		requesterId: uuid('requester_id')
			.notNull()
			.references(() => users.id),
		serviceId: uuid('service_id')
			.notNull()
			.references(() => services.id),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id),
		agentId: uuid('agent_id').references(() => users.id),
		kind: text().notNull(),
		subject: text().notNull(),
		description: text().notNull(),
		impact: integer().notNull(),
		urgency: integer().notNull(),
		priority: text()
			.notNull()
			.references(() => targetSettings.priority),
		status: ticketStatus().notNull().default('BARU'),
		version: integer().notNull().default(1),
		resolution: text(),
		responseDue: time('response_due').notNull(),
		firstResponseAt: time('first_response_at'),
		resolutionDue: time('resolution_due'),
		resolutionRemainingMs: bigint('resolution_remaining_ms', { mode: 'number' }).notNull(),
		pausedAt: time('paused_at'),
		relatedId: uuid('related_id'),
		idempotencyKey: uuid('idempotency_key').notNull(),
		createdAt: time('created_at').notNull().defaultNow(),
		updatedAt: time('updated_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('tickets_requester_idempotency').on(t.requesterId, t.idempotencyKey),
		index('tickets_team_queue').on(t.teamId, t.status, t.createdAt)
	]
);
export const messages = pgTable('messages', {
	id: uuid().primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id),
	authorId: uuid('author_id')
		.notNull()
		.references(() => users.id),
	body: text().notNull(),
	internal: boolean().notNull().default(false),
	createdAt: time('created_at').notNull().defaultNow()
});
export const attachments = pgTable('attachments', {
	id: uuid().primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id),
	name: text().notNull(),
	storageName: uuid('storage_name').notNull().unique(),
	mime: text().notNull(),
	size: integer().notNull(),
	createdAt: time('created_at').notNull().defaultNow()
});
export const ticketEvents = pgTable('ticket_events', {
	id: uuid().primaryKey().defaultRandom(),
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id),
	actorId: uuid('actor_id')
		.notNull()
		.references(() => users.id),
	kind: text().notNull(),
	detail: text().notNull(),
	internal: boolean().notNull().default(false),
	createdAt: time('created_at').notNull().defaultNow()
});
export const articles = pgTable('articles', {
	id: uuid().primaryKey().defaultRandom(),
	slug: text().notNull().unique(),
	title: text().notNull(),
	body: text().notNull(),
	serviceId: uuid('service_id')
		.notNull()
		.references(() => services.id),
	published: boolean().notNull().default(false),
	updatedAt: time('updated_at').notNull().defaultNow()
});
export const notifications = pgTable('notifications', {
	id: uuid().primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id),
	ticketId: uuid('ticket_id')
		.notNull()
		.references(() => tickets.id),
	body: text().notNull(),
	readAt: time('read_at'),
	createdAt: time('created_at').notNull().defaultNow()
});
export const loginAttempts = pgTable('login_attempts', {
	key: text().primaryKey(),
	attempts: integer().notNull(),
	resetAt: time('reset_at').notNull()
});
