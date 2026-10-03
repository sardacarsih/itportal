import { redirect, type RequestHandler } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { getGoogleAuthUrl } from '$lib/server/google';
import { production } from '$lib/server/config';

export const GET: RequestHandler = ({ cookies }) => {
	const state = randomBytes(32).toString('hex');
	cookies.set('oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: production,
		maxAge: 600 // 10 menit
	});
	redirect(302, getGoogleAuthUrl(state));
};
