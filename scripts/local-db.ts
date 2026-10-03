import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const bin = process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/' : '';
const data = resolve('.local/postgres');
await mkdir('.local', { recursive: true });
if (existsSync('.env') || existsSync(data))
	throw new Error('Local configuration already exists; follow README to restart it.');
const password = crypto.randomUUID() + crypto.randomUUID();
await Bun.write('.local/pg-password', password);
async function run(name: string, args: string[]) {
	const p = Bun.spawn([bin + name, ...args], { stdout: 'inherit', stderr: 'inherit' });
	if ((await p.exited) !== 0) throw new Error(name + ' failed');
}
await run('initdb', [
	'-D',
	data,
	'-U',
	'itportal',
	'--pwfile',
	resolve('.local/pg-password'),
	'--auth=scram-sha-256',
	'--encoding=UTF8',
	'--locale=C'
]);
await run('pg_ctl', [
	'-D',
	data,
	'-l',
	resolve('.local/postgres.log'),
	'-o',
	'-h 127.0.0.1 -p 55439',
	'start'
]);
const env = { ...process.env, PGPASSWORD: password };
const p = Bun.spawn(
	[bin + 'createdb', '-h', '127.0.0.1', '-p', '55439', '-U', 'itportal', 'itportal'],
	{ env, stdout: 'inherit', stderr: 'inherit' }
);
if (await p.exited) throw new Error('createdb failed');
await Bun.write(
	'.env',
	`DATABASE_URL=postgres://itportal:${password}@127.0.0.1:55439/itportal
APP_ORIGIN=http://localhost:5174
ORIGIN=http://localhost:5174
UPLOAD_DIR=${resolve('.local/uploads').replaceAll('\\', '/')}
BOOTSTRAP_EMAIL=admin@example.test
BOOTSTRAP_PASSWORD=${crypto.randomUUID()}Aa!
SEED_AGENT_PASSWORD=${crypto.randomUUID()}Aa!
SEED_REQUESTER_PASSWORD=${crypto.randomUUID()}Aa!
SEED_DEMO=true
`
);
await Bun.file('.local/pg-password').delete();
console.log(
	'Dedicated database created on 127.0.0.1:55439. Local credentials saved only in ignored .env.'
);
