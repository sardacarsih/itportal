import { fail, redirect } from '@sveltejs/kit';
import { db, one, sql } from '$lib/server/db';
import { z } from 'zod';
import { passwordInput, fields, invalid } from '$lib/server/validation';
export const actions: import('./$types').Actions = {
	profile: async ({ locals, request }) => {
		const p = z
			.object({ name: z.string().trim().min(2).max(100), department: z.string().trim().max(100) })
			.safeParse(fields(await request.formData()));
		if (!p.success) return invalid(p.error);
		await db.execute(
			sql`UPDATE users SET name=${p.data.name},department=${p.data.department} WHERE id=${locals.user!.id}::uuid`
		);
		return { success: 'Profil diperbarui.' };
	},
	password: async ({ locals, request, cookies }) => {
		const p = z
			.object({ current: z.string().max(128), password: passwordInput })
			.safeParse(fields(await request.formData()));
		if (!p.success) return invalid(p.error);
		const user = await one<{ password_hash: string }>(
			sql`SELECT password_hash FROM users WHERE id=${locals.user!.id}::uuid`
		);
		if (!user || !(await Bun.password.verify(p.data.current, user.password_hash)))
			return fail(400, { message: 'Kata sandi saat ini tidak sesuai.' });
		const hash = await Bun.password.hash(p.data.password, {
			algorithm: 'argon2id',
			memoryCost: 19456,
			timeCost: 2
		});
		await db.transaction(async (tx) => {
			await tx.execute(
				sql`UPDATE users SET password_hash=${hash} WHERE id=${locals.user!.id}::uuid`
			);
			await tx.execute(sql`DELETE FROM sessions WHERE user_id=${locals.user!.id}::uuid`);
		});
		cookies.delete('portal_session', { path: '/' });
		redirect(303, '/login?password=changed');
	}
};
