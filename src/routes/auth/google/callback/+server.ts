import { redirect, error, type RequestHandler } from '@sveltejs/kit';
import { db, one, sql } from '$lib/server/db';
import { createSession } from '$lib/server/auth';
import { exchangeGoogleCode, isGoogleEmailAllowed } from '$lib/server/google';
import { production } from '$lib/server/config';
import { randomBytes } from 'node:crypto';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const savedState = cookies.get('oauth_state');
	cookies.delete('oauth_state', { path: '/' });

	if (!code || !state || !savedState || state !== savedState) {
		error(400, 'Verifikasi otorisasi tidak valid atau kedaluwarsa. Silakan coba kembali.');
	}

	let googleUser;
	try {
		googleUser = await exchangeGoogleCode(code);
	} catch (e) {
		console.error('Google exchange error:', e);
		error(400, 'Gagal mengautentikasi dengan Google.');
	}

	if (!googleUser.email_verified) {
		error(400, 'Email Google Anda belum diverifikasi.');
	}

	const email = googleUser.email.toLowerCase();
	if (!isGoogleEmailAllowed(email)) {
		error(403, 'Akun Google ini tidak diizinkan. Hubungi administrator portal.');
	}

	type GoogleAccount = {
		id: string;
		department: string;
		active: boolean;
		email: string;
		google_sub: string | null;
	};
	let account: GoogleAccount | undefined;
	try {
		account = await db.transaction(async (tx) => {
			// Serialize provisioning so callbacks cannot race on the email or Google subject.
			await tx.execute(sql`SELECT pg_advisory_xact_lock(8172402)`);
			let existing = await one<GoogleAccount>(
				sql`SELECT id,department,active,email,google_sub FROM users WHERE google_sub=${googleUser.sub}`,
				tx
			);
			if (!existing) {
				existing = await one<GoogleAccount>(
					sql`SELECT id,department,active,email,google_sub FROM users WHERE email=${email}`,
					tx
				);
				if (existing?.google_sub && existing.google_sub !== googleUser.sub) {
					throw new Error('GOOGLE_IDENTITY_CONFLICT');
				}
				if (!existing) {
					const dummyHash = await Bun.password.hash('unusable-' + randomBytes(32).toString('hex'), {
						algorithm: 'argon2id',
						memoryCost: 19456,
						timeCost: 2
					});
					existing = await one<GoogleAccount>(
						sql`INSERT INTO users (email,name,role,department,password_hash,active,google_sub)
							VALUES (${email},${googleUser.name},'PEMOHON','',${dummyHash},true,${googleUser.sub})
							ON CONFLICT DO NOTHING
							RETURNING id,department,active,email,google_sub`,
						tx
					);
				}
				if (!existing) {
					existing = await one<GoogleAccount>(
						sql`SELECT id,department,active,email,google_sub FROM users WHERE google_sub=${googleUser.sub}`,
						tx
					);
					existing ??= await one<GoogleAccount>(
						sql`SELECT id,department,active,email,google_sub FROM users WHERE email=${email}`,
						tx
					);
				}
				if (!existing || (existing.google_sub && existing.google_sub !== googleUser.sub)) {
					throw new Error('GOOGLE_IDENTITY_CONFLICT');
				}
				if (!existing.active) throw new Error('GOOGLE_ACCOUNT_DISABLED');
				if (!existing.google_sub) {
					await tx.execute(
						sql`UPDATE users SET google_sub=${googleUser.sub} WHERE id=${existing.id}::uuid`
					);
				}
			}
			return existing;
		});
	} catch (e) {
		if (e instanceof Error && e.message === 'GOOGLE_IDENTITY_CONFLICT') {
			error(409, 'Akun Google tidak dapat ditautkan ke profil ini. Hubungi administrator portal.');
		}
		if (e instanceof Error && e.message === 'GOOGLE_ACCOUNT_DISABLED') {
			error(403, 'Akun Anda dinonaktifkan. Hubungi administrator portal.');
		}
		throw e;
	}
	const user = account && {
		id: account.id,
		department: account.department,
		active: account.active
	};

	if (!user?.active) {
		error(403, 'Akun Anda dinonaktifkan. Hubungi administrator portal.');
	}

	// Buat sesi login portal
	const token = await createSession(user.id, cookies.get('portal_session'));
	cookies.set('portal_session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: production,
		maxAge: 604800
	});

	// Jika departemen belum dipilih, arahkan ke onboarding
	if (!user.department || user.department.trim() === '') {
		redirect(303, '/onboarding');
	}

	redirect(303, '/');
};
