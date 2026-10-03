import { client, db, sql, rows } from '../src/lib/server/db';
import { readdir } from 'node:fs/promises';
await db.execute(
	sql`CREATE TABLE IF NOT EXISTS portal_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`
);
for (const name of (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort()) {
	const existing = await rows(sql`SELECT name FROM portal_migrations WHERE name=${name}`);
	if (existing.length) continue;
	await client.begin(async (tx) => {
		await tx.unsafe(await Bun.file(`migrations/${name}`).text());
		await tx`INSERT INTO portal_migrations(name) VALUES (${name})`;
	});
	console.log(`Applied ${name}`);
}
await client.end();
