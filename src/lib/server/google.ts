import { setting, origin } from './config';
import { z } from 'zod';

const tokenSchema = z.object({ access_token: z.string().min(1) });
const profileSchema = z.object({
	sub: z.string().min(1),
	email: z.email(),
	name: z.string().optional(),
	email_verified: z.boolean()
});

export function isGoogleConfigured() {
	if (process.env.GOOGLE_MOCK === 'true') return false;
	return Boolean(setting('GOOGLE_CLIENT_ID') && setting('GOOGLE_CLIENT_SECRET'));
}

export function isGoogleMockEnabled() {
	return process.env.GOOGLE_MOCK === 'true' && setting('NODE_ENV') !== 'production';
}

export function isGoogleEmailAllowed(email: string) {
	if (isGoogleMockEnabled()) return true;
	const domains = (setting('GOOGLE_ALLOWED_DOMAINS') || '')
		.split(',')
		.map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
		.filter(Boolean);
	return domains.includes(email.slice(email.lastIndexOf('@') + 1).toLowerCase());
}

export function getGoogleAuthUrl(state: string) {
	if (!isGoogleConfigured()) {
		return `/auth/google/mock?state=${encodeURIComponent(state)}`;
	}
	const clientId = setting('GOOGLE_CLIENT_ID')!;
	const redirectUri = `${origin}/auth/google/callback`;
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state,
		access_type: 'offline',
		prompt: 'select_account'
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
	if (code.startsWith('mock:') && isGoogleMockEnabled()) {
		const payload = code.slice(5);
		const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return {
			sub: json.sub || 'google-mock-' + Date.now(),
			email: (json.email || 'user@example.test').toLowerCase(),
			name: json.name || 'Pengguna Google',
			email_verified: true
		};
	}

	const clientId = setting('GOOGLE_CLIENT_ID')!;
	const clientSecret = setting('GOOGLE_CLIENT_SECRET')!;
	const redirectUri = `${origin}/auth/google/callback`;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		signal: AbortSignal.timeout(10_000),
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!res.ok) {
		const errText = await res.text();
		console.error('Google token exchange failed:', errText);
		throw new Error('Gagal menukarkan kode otorisasi Google.');
	}

	const tokenResult = tokenSchema.safeParse(await res.json());
	if (!tokenResult.success) throw new Error('Respons token Google tidak valid.');

	const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: { Authorization: `Bearer ${tokenResult.data.access_token}` },
		signal: AbortSignal.timeout(10_000)
	});

	if (!userRes.ok) {
		throw new Error('Gagal mengambil data profil Google.');
	}

	const profileResult = profileSchema.safeParse(await userRes.json());
	if (!profileResult.success) throw new Error('Profil Google tidak lengkap atau tidak valid.');
	const profile = profileResult.data;

	return {
		sub: profile.sub,
		email: profile.email.toLowerCase(),
		name: profile.name?.trim() || profile.email.split('@')[0],
		email_verified: profile.email_verified
	};
}
