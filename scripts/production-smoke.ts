import postgres from 'postgres';
import { setting, origin, databaseUrl } from '../src/lib/server/config';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
process.env.NODE_ENV = 'production';
process.env.HOST = '127.0.0.1';
process.env.PORT = new URL(origin).port || '5174';
process.env.ORIGIN = origin;
process.env.BODY_SIZE_LIMIT = '55M';
const bundlePath = '../build/index.js';
const bundle = await import(bundlePath);
const checks: string[] = [];
let cookie = '';
function request(path: string, options: RequestInit = {}) {
	return fetch(origin + path, {
		...options,
		redirect: 'manual',
		headers: { Accept: 'text/html', ...(cookie ? { cookie } : {}), ...options.headers }
	});
}
function form(data: Record<string, string>) {
	return {
		method: 'POST',
		headers: { origin, 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(data)
	};
}
try {
	const health = await request('/healthz');
	assert.equal(health.status, 200);
	assert.deepEqual(await health.json(), { status: 'ready' });
	checks.push('readiness');
	const login = await request(
		'/login',
		form({ email: 'pemohon@example.test', password: setting('SEED_REQUESTER_PASSWORD')! })
	);

	assert.equal(login.status, 303);
	const header = login.headers.get('set-cookie')!;
	assert(/httponly/i.test(header) && /secure/i.test(header) && /samesite=lax/i.test(header));
	cookie = header.split(';')[0];
	checks.push('production login and Secure/HttpOnly/SameSite cookies');
	const home = await request('/');
	assert.equal(home.status, 200);
	assert((await home.text()).includes('Bantuan untuk pekerjaan'));
	checks.push('authenticated SSR');
	const createPage = await request('/tiket/baru');
	const html = await createPage.text();
	const service = /name="service"[^]*?<option value="([0-9a-f-]+)"/.exec(html)![1];
	const key = /name="key" value="([0-9a-f-]+)"/.exec(html)![1];
	const data = new FormData();
	for (const [name, value] of Object.entries({
		key,
		service,
		kind: 'INCIDENT',
		subject: 'Production smoke fictional ticket',
		description: 'Fictional production smoke evidence for Bun form and download testing.',
		impact: '1',
		urgency: '1',
		related: ''
	}))
		data.set(name, value);
	data.set('attachments', new File(['Fictional smoke log'], 'smoke.txt', { type: 'text/plain' }));
	const submitted = await request('/tiket/baru', {
		method: 'POST',
		headers: { origin },
		body: data
	});
	assert.equal(submitted.status, 303);
	const location = submitted.headers.get('location')!;
	const detail = await request(location);
	assert.equal(detail.status, 200);
	const text = await detail.text();
	const attachment = /href="(\/lampiran\/[0-9a-f-]+)"/.exec(text)![1];
	const download = await request(attachment);
	assert.equal(download.status, 200);
	assert((await download.text()).includes('Fictional smoke log'));
	assert(download.headers.get('content-disposition')?.includes('attachment'));
	checks.push('multipart creation and private download in actual Bun bundle');
	const retry = await request('/tiket/baru', { method: 'POST', headers: { origin }, body: data });
	assert.equal(retry.headers.get('location'), location);
	checks.push('idempotent production retry');
	assert.equal(
		(await request('/logout', { method: 'POST', headers: { origin: 'https://evil.example' } }))
			.status,
		403
	);
	checks.push('production CSRF');
	assert.equal((await request('/logout', form({}))).status, 303);
	assert.equal((await request('/')).status, 303);
	checks.push('logout revocation');
	// Windows does not deliver POSIX SIGTERM; exercise the installed bundle's signal handler directly.
	const ticketId = new URL(origin + location).pathname.split('/').at(-1)!;
	const lock = postgres(databaseUrl(), { max: 1 });
	let ready!: () => void;
	let release!: () => void;
	const readyPromise = new Promise<void>((resolve) => (ready = resolve));
	const releasePromise = new Promise<void>((resolve) => (release = resolve));
	const locked = lock.begin(async (tx) => {
		await tx`SELECT id FROM tickets WHERE id=${ticketId}::uuid FOR UPDATE`;
		ready();
		await releasePromise;
	});
	await readyPromise;
	// Authenticate a fresh session after the logout check, then hold a live write in-flight.
	const again = await request(
		'/login',
		form({ email: 'pemohon@example.test', password: setting('SEED_REQUESTER_PASSWORD')! })
	);
	cookie = again.headers.get('set-cookie')!.split(';')[0];
	let finished = false;
	const pending = request(
		'/tiket/' + ticketId + '?/reply',
		form({ version: '1', body: 'In-flight graceful shutdown evidence' })
	).then((response) => {
		finished = true;
		return response;
	});
	await Bun.sleep(100);
	assert(!finished, 'Request must be waiting for the database row lock');
	process.emit('SIGTERM', 'SIGTERM');
	release();
	await locked;
	const drained = await pending;
	assert.equal(drained.status, 200);
	assert((await drained.text()).includes('Pesan tersimpan'));
	const written =
		await lock`SELECT id FROM messages WHERE ticket_id=${ticketId}::uuid AND body='In-flight graceful shutdown evidence'`;
	assert.equal(written.length, 1);
	await bundle.server.stop(false);
	await lock.end();
	checks.push(
		'shutdown drains a real in-flight form submission before closing listener and database pool'
	);
	await mkdir('artifacts', { recursive: true });
	await Bun.write(
		'artifacts/production-smoke.json',
		JSON.stringify(
			{
				runtime: Bun.version,
				checks,
				shutdown: 'SIGTERM handler invoked programmatically on Windows'
			},
			null,
			2
		)
	);
	console.log(JSON.stringify({ runtime: Bun.version, checks }, null, 2));
} catch (e) {
	console.error('Completed checks', checks);
	process.emit('SIGTERM', 'SIGTERM');
	await bundle.server.stop(false);
	throw e;
}
