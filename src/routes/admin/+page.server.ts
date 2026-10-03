import { db, rows, sql } from '$lib/server/db';
import { services, articles } from '$lib/server/portal';
import { saveUser } from '$lib/server/admin';
import { z } from 'zod';
import { fields, invalid, actionError, passwordInput } from '$lib/server/validation';
export const load = async () => ({
	users: await rows<{
		id: string;
		email: string;
		name: string;
		department: string;
		role: 'PEMOHON' | 'AGEN' | 'ADMIN';
		active: boolean;
		team_ids: string[];
	}>(
		sql`SELECT u.id,u.name,u.email,u.department,u.role,u.active,COALESCE(array_agg(m.team_id) FILTER(WHERE m.team_id IS NOT NULL),'{}') AS team_ids FROM users u LEFT JOIN memberships m ON m.user_id=u.id GROUP BY u.id ORDER BY u.name`
	),
	teams: await rows<{ id: string; name: string }>(sql`SELECT * FROM teams ORDER BY name`),
	services: await services(true),
	articles: await articles(new URLSearchParams(), true),
	targets: await rows<{ priority: string; response_hours: number; resolution_hours: number }>(
		sql`SELECT * FROM target_settings ORDER BY priority`
	),
	mapping: await rows<{ impact: number; urgency: number; priority: string }>(
		sql`SELECT * FROM priority_settings ORDER BY impact,urgency`
	)
});
const handlers: import('./$types').Actions = {
	user: async ({ request }) => {
		const form = await request.formData();
		const p = z
			.object({
				id: z.union([z.uuid(), z.literal('')]).optional(),
				name: z.string().trim().min(2).max(100),
				email: z.email().transform((v) => v.toLowerCase()),
				department: z.string().trim().max(100),
				role: z.enum(['PEMOHON', 'AGEN', 'ADMIN']),
				password: z.union([passwordInput, z.literal('')]).optional()
			})
			.safeParse(fields(form));
		if (!p.success) return invalid(p.error);
		const teams = z.array(z.uuid()).safeParse(form.getAll('teams'));
		if (!teams.success) return invalid(teams.error);
		try {
			await saveUser({
				...p.data,
				id: p.data.id || undefined,
				password: p.data.password || undefined,
				active: form.get('active') === 'on',
				teams: teams.data
			});
			return { success: 'Pengguna tersimpan. Sesi sebelumnya dicabut.' };
		} catch (e) {
			if (e instanceof Error && 'code' in e && e.code === '23505')
				return { message: 'Email sudah digunakan.' };
			return actionError(e);
		}
	},
	team: async ({ request }) => {
		const p = z
			.object({
				id: z.union([z.uuid(), z.literal('')]).optional(),
				name: z.string().trim().min(2).max(100)
			})
			.safeParse(fields(await request.formData()));
		if (!p.success) return invalid(p.error);
		if (p.data.id)
			await db.execute(sql`UPDATE teams SET name=${p.data.name} WHERE id=${p.data.id}::uuid`);
		else await db.execute(sql`INSERT INTO teams(name) VALUES(${p.data.name})`);
		return { success: 'Tim tersimpan.' };
	},
	service: async ({ request }) => {
		const form = await request.formData();
		const p = z
			.object({
				id: z.union([z.uuid(), z.literal('')]),
				name: z.string().trim().min(2).max(100),
				description: z.string().trim().min(10).max(2000),
				kind: z.enum(['INCIDENT', 'REQUEST']),
				team: z.uuid()
			})
			.safeParse(fields(form));
		if (!p.success) return invalid(p.error);
		const v = p.data;
		const active = form.get('active') === 'on';
		if (v.id)
			await db.execute(
				sql`UPDATE services SET name=${v.name},description=${v.description},kind=${v.kind},team_id=${v.team}::uuid,active=${active} WHERE id=${v.id}::uuid`
			);
		else
			await db.execute(
				sql`INSERT INTO services(name,description,kind,team_id,active) VALUES(${v.name},${v.description},${v.kind},${v.team}::uuid,${active})`
			);
		return { success: 'Layanan tersimpan.' };
	},
	article: async ({ request }) => {
		const form = await request.formData();
		const p = z
			.object({
				id: z.union([z.uuid(), z.literal('')]),
				slug: z
					.string()
					.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
					.max(120),
				title: z.string().trim().min(5).max(180),
				body: z.string().trim().min(20).max(30000),
				service: z.uuid()
			})
			.safeParse(fields(form));
		if (!p.success) return invalid(p.error);
		const v = p.data;
		const published = form.get('published') === 'on';
		if (v.id)
			await db.execute(
				sql`UPDATE articles SET slug=${v.slug},title=${v.title},body=${v.body},service_id=${v.service}::uuid,published=${published},updated_at=now() WHERE id=${v.id}::uuid`
			);
		else
			await db.execute(
				sql`INSERT INTO articles(slug,title,body,service_id,published) VALUES(${v.slug},${v.title},${v.body},${v.service}::uuid,${published})`
			);
		return { success: 'Artikel tersimpan.' };
	},
	target: async ({ request }) => {
		const p = z
			.object({
				priority: z.enum(['P1', 'P2', 'P3', 'P4']),
				response: z.coerce.number().int().min(1).max(8760),
				resolution: z.coerce.number().int().min(1).max(8760)
			})
			.safeParse(fields(await request.formData()));
		if (!p.success) return invalid(p.error);
		await db.execute(
			sql`UPDATE target_settings SET response_hours=${p.data.response},resolution_hours=${p.data.resolution} WHERE priority=${p.data.priority}`
		);
		return { success: 'Target diperbarui untuk tiket baru. Tiket lama mempertahankan targetnya.' };
	},
	mapping: async ({ request }) => {
		const p = z
			.object({
				impact: z.coerce.number().int().min(1).max(3),
				urgency: z.coerce.number().int().min(1).max(3),
				priority: z.enum(['P1', 'P2', 'P3', 'P4'])
			})
			.safeParse(fields(await request.formData()));
		if (!p.success) return invalid(p.error);
		await db.execute(
			sql`UPDATE priority_settings SET priority=${p.data.priority} WHERE impact=${p.data.impact} AND urgency=${p.data.urgency}`
		);
		return { success: 'Pemetaan prioritas diperbarui.' };
	}
};

export const actions: import('./$types').Actions = Object.fromEntries(
	Object.entries(handlers).map(([name, handler]) => [
		name,
		async (event: import('./$types').RequestEvent) => {
			try {
				return await handler(event);
			} catch (e) {
				return actionError(e);
			}
		}
	])
);
