import { error } from '@sveltejs/kit';
import { one, sql } from '$lib/server/db';
import { getTicket, type Attachment } from '$lib/server/portal';
import { uploadDir } from '$lib/server/config';
import { join } from 'node:path';
export async function GET({ params, locals }: import('./$types').RequestEvent) {
	if (!/^[0-9a-f-]{36}$/i.test(params.id)) error(404, 'Lampiran tidak ditemukan.');
	const file = await one<Attachment & { ticket_id: string }>(
		sql`SELECT * FROM attachments WHERE id=${params.id}::uuid`
	);
	if (!file) error(404, 'Lampiran tidak ditemukan.');
	try {
		await getTicket(locals.user!, file.ticket_id);
	} catch {
		error(404, 'Lampiran tidak ditemukan.');
	}
	const content = Bun.file(join(uploadDir, file.storage_name));
	if (!(await content.exists())) error(404, 'Berkas lampiran tidak tersedia.');
	return new Response(content, {
		headers: {
			'Content-Type': file.mime,
			'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store',
			'Content-Security-Policy': "sandbox; default-src 'none'"
		}
	});
}
