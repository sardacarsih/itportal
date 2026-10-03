import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { authenticate, createSession } from '$lib/server/auth';
import { production } from '$lib/server/config';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		if (!locals.user.department || locals.user.department.trim() === '') {
			redirect(303, '/onboarding');
		}
		redirect(303, '/');
	}
};
export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const data = Object.fromEntries(await request.formData());
		const input = z
			.object({
				email: z.email().transform((v) => v.trim().toLowerCase()),
				password: z.string().min(1).max(128)
			})
			.safeParse(data);
		if (!input.success)
			return fail(400, {
				message: 'Masukkan email dan kata sandi yang valid.',
				email: String(data.email || '')
			});
		const result = await authenticate(input.data.email, input.data.password, getClientAddress());
		if (result.limited)
			return fail(429, {
				message: 'Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.',
				email: input.data.email
			});
		if (!result.user)
			return fail(400, { message: 'Email atau kata sandi tidak sesuai.', email: input.data.email });
		const token = await createSession(result.user.id, cookies.get('portal_session'));
		cookies.set('portal_session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: production,
			maxAge: 604800
		});
		redirect(303, '/');
	}
};
