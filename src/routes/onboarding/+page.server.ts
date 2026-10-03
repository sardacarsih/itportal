import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db, sql } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';
import { departments } from '$lib/departments';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.department && locals.user.department.trim() !== '') {
		redirect(303, '/');
	}
	return { user: locals.user };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) redirect(303, '/login');

		const data = Object.fromEntries(await request.formData());
		const selected = String(data.department || '').trim();
		const custom = String(data.customDepartment || '').trim();

		if (!z.enum(departments).safeParse(selected).success) {
			return fail(400, {
				message: 'Pilih departemen yang tersedia.',
				department: selected,
				customDepartment: custom
			});
		}
		const finalDepartment = selected === 'LAINNYA' ? custom : selected;

		const schema = z.object({
			department: z
				.string()
				.trim()
				.min(2, 'Nama departemen minimal 2 karakter.')
				.max(100, 'Nama departemen maksimal 100 karakter.')
		});

		const parsed = schema.safeParse({ department: finalDepartment });
		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message || 'Pilihan departemen tidak valid.',
				department: selected,
				customDepartment: custom
			});
		}

		await db.execute(
			sql`UPDATE users SET department = ${parsed.data.department} WHERE id = ${locals.user.id}::uuid`
		);

		redirect(303, '/');
	}
};
