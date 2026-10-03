import { detail, changeTicket } from '$lib/server/portal';
import { rows, sql } from '$lib/server/db';
import { actionError, fields, invalid } from '$lib/server/validation';
import { z } from 'zod';
import { statuses } from '$lib/domain';
import { fail } from '@sveltejs/kit';
export const load: import('./$types').PageServerLoad = async ({ locals, params, url }) => {
	try {
		return {
			...(await detail(locals.user!, params.id)),
			teams:
				locals.user!.role === 'ADMIN'
					? await rows<{ id: string; name: string }>(sql`SELECT * FROM teams ORDER BY name`)
					: [],
			created: url.searchParams.get('created') === '1'
		};
	} catch (e) {
		if (e instanceof Error && 'status' in e) {
			const { error } = await import('@sveltejs/kit');
			error(Number(e.status), e.message);
		}
		throw e;
	}
};
const base = z.object({ version: z.coerce.number().int().positive() });
export const actions: import('./$types').Actions = {
	status: async ({ request, locals, params }) => {
		const parsed = base
			.extend({ status: z.enum(statuses), note: z.string().trim().max(10000).default('') })
			.safeParse(fields(await request.formData()));
		if (!parsed.success) return invalid(parsed.error);
		try {
			await changeTicket(locals.user!, params.id, parsed.data.version, {
				type: 'status',
				status: parsed.data.status,
				note: parsed.data.note
			});
			return { success: 'Status tiket diperbarui.' };
		} catch (e) {
			return actionError(e);
		}
	},
	reply: async ({ request, locals, params }) => {
		const parsed = base
			.extend({ body: z.string().trim().min(1).max(10000), internal: z.string().optional() })
			.safeParse(fields(await request.formData()));
		if (!parsed.success) return invalid(parsed.error);
		try {
			await changeTicket(locals.user!, params.id, parsed.data.version, {
				type: 'reply',
				body: parsed.data.body,
				internal: parsed.data.internal === 'on'
			});
			return { success: 'Pesan tersimpan.' };
		} catch (e) {
			return actionError(e);
		}
	},
	assign: async ({ request, locals, params }) => {
		const parsed = base
			.extend({ agent: z.union([z.uuid(), z.literal('')]), team: z.uuid() })
			.safeParse(fields(await request.formData()));
		if (!parsed.success) return invalid(parsed.error);
		try {
			await changeTicket(locals.user!, params.id, parsed.data.version, {
				type: 'assign',
				agent: parsed.data.agent || null,
				team: parsed.data.team
			});
			return { success: 'Penugasan diperbarui.' };
		} catch (e) {
			return actionError(e);
		}
	}
};
