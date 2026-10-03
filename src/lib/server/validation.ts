import { z } from 'zod';
import { fail } from '@sveltejs/kit';
export const ticketInput = z.object({
	key: z.uuid(),
	service: z.uuid(),
	subject: z.string().trim().min(5, 'Subjek minimal 5 karakter.').max(180),
	description: z.string().trim().min(15, 'Jelaskan kendala minimal 15 karakter.').max(10000),
	kind: z.enum(['INCIDENT', 'REQUEST']),
	impact: z.coerce.number().int().min(1).max(3),
	urgency: z.coerce.number().int().min(1).max(3),
	related: z.union([z.uuid(), z.literal('')]).optional()
});
export const passwordInput = z.string().min(12, 'Kata sandi minimal 12 karakter.').max(128);
export function fields(form: FormData) {
	return Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
}
export function invalid(err: z.ZodError) {
	return fail(400, {
		message:
			err.issues[0]?.message && !/^(Invalid|Too|Expected|Unrecognized)/.test(err.issues[0].message)
				? err.issues[0].message
				: 'Data tidak valid. Periksa kembali kolom yang diisi.'
	});
}
export class PortalError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
export function actionError(e: unknown) {
	let cause: unknown = e;
	for (let depth = 0; depth < 4 && cause && typeof cause === 'object'; depth++) {
		if ('code' in cause && cause.code === '23505')
			return fail(409, { message: 'Data dengan email, nama, atau slug tersebut sudah tersedia.' });
		if ('code' in cause && cause.code === '23503')
			return fail(400, {
				message: 'Data terkait tidak tersedia. Muat ulang halaman dan periksa pilihan Anda.'
			});
		cause = 'cause' in cause ? cause.cause : null;
	}
	if (e instanceof PortalError) return fail(e.status, { message: e.message });
	throw e;
}
