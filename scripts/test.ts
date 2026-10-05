import postgres from 'postgres';
import { databaseUrl } from '../src/lib/server/config';
import { readdir } from 'node:fs/promises';
const url = new URL(databaseUrl());
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
	throw new Error('Automatic test DB provisioning is restricted to local PostgreSQL.');
const testName = 'itportal_test';
const admin = postgres(url.toString(), { max: 1 });
const existing = await admin`SELECT datname FROM pg_database WHERE datname=${testName}`;
if (!existing.length) await admin.unsafe('CREATE DATABASE itportal_test');
await admin.end();
url.pathname = '/' + testName;
const test = postgres(url.toString(), { max: 1 });
await test`CREATE TABLE IF NOT EXISTS portal_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now())`;
for (const name of (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort()) {
	const exists = await test`SELECT name FROM portal_migrations WHERE name=${name}`;
	if (!exists.length)
		await test.begin(async (tx) => {
			await tx.unsafe(await Bun.file('migrations/' + name).text());
			await tx`INSERT INTO portal_migrations(name) VALUES(${name})`;
		});
}
await test.end();
const env = {
	...process.env,
	NODE_ENV: 'test',
	PORTAL_TEST_DATABASE_URL: url.toString(),
	PORTAL_TEST_UPLOAD_DIR: new URL('../.local/test-uploads', import.meta.url).pathname.replace(
		/^\/(?:([A-Za-z]):)/,
		'$1:'
	)
};
const seed = Bun.spawn([process.execPath, 'scripts/seed.ts'], {
	env,
	stdout: 'inherit',
	stderr: 'inherit'
});
if (await seed.exited) throw new Error('Test seed failed.');
const tests = Bun.spawn([process.execPath, 'test', 'tests/unit', 'tests/integration'], {
	env,
	stdout: 'inherit',
	stderr: 'inherit'
});
process.exit(await tests.exited);
