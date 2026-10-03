import { rows, sql, client } from '../src/lib/server/db';
import { uploadDir } from '../src/lib/server/config';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
const metadata = await rows<{ id: string; storage_name: string }>(
	sql`SELECT id,storage_name FROM attachments`
);
const disk = await readdir(uploadDir).catch(() => []);
const expected = new Set(metadata.map((m) => m.storage_name));
const missing = [];
for (const record of metadata)
	if (!(await Bun.file(join(uploadDir, record.storage_name)).exists()))
		missing.push({ attachmentId: record.id, storageName: record.storage_name });
const orphan = disk.filter((n) => n !== '.staging' && !expected.has(n));
const staged = await readdir(join(uploadDir, '.staging')).catch(() => []);
console.log(
	JSON.stringify(
		{
			mode: 'read-only',
			missing,
			orphan,
			staged,
			note: 'Stop writes and back up database/files before manual reconciliation. No files were modified.'
		},
		null,
		2
	)
);
await client.end();
