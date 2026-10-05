import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, cookies }) => {
	const state = url.searchParams.get('state') || cookies.get('oauth_state');
	if (!state) redirect(303, '/login');
	return { state };
};

export const actions: Actions = {
	default: async ({ request, url, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') || '').trim();
		const name = String(data.get('name') || '').trim();
		const state = String(
			data.get('state') || url.searchParams.get('state') || cookies.get('oauth_state') || ''
		);

		if (!email || !email.includes('@')) {
			return fail(400, { message: 'Masukkan email Google yang valid.', email, name });
		}
		if (!name) {
			return fail(400, { message: 'Masukkan nama pengguna.', email, name });
		}

		const payload = Buffer.from(
			JSON.stringify({
				sub: 'google-mock-' + Buffer.from(email).toString('hex').slice(0, 16),
				email,
				name
			})
		).toString('base64url');

		const code = `mock:${payload}`;
		redirect(
			303,
			`/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
		);
	}
};
