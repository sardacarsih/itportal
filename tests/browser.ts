import { chromium, type Page, type BrowserContext } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setting } from '../src/lib/server/config';
const base = 'http://localhost:5174';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const checks: string[] = [];
function watch(page: Page) {
	page.on('pageerror', (e) => errors.push(e.message));
}
async function login(email: string, key: string) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const page = await context.newPage();
	watch(page);
	await page.goto(base + '/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Kata sandi', { exact: true }).fill(setting(key)!);
	await page.getByRole('button', { name: 'Masuk ke portal' }).click();
	await page.waitForURL(base + '/');
	await page.waitForLoadState('networkidle');
	return { context, page };
}
async function success(page: Page, text: string) {
	try {
		await page.getByRole('status').filter({ hasText: text }).waitFor({ timeout: 10000 });
		await page.waitForFunction(() => !document.querySelector('button:disabled'));
		await page.waitForLoadState('networkidle');
	} catch (e) {
		await page.screenshot({ path: 'artifacts/browser-failure.png', fullPage: true });
		console.log(
			'Failed action',
			text,
			'alerts',
			await page.locator('.alert').allTextContents(),
			'url',
			page.url(),
			'checks',
			checks
		);
		throw e;
	}
}
async function status(page: Page, value: string, note = '') {
	await page.locator('select[name=status]').selectOption(value);
	await page.locator('textarea[name=note]').fill(note);
	await page.getByRole('button', { name: 'Simpan status' }).click();
	await success(page, 'Status tiket diperbarui');
}
try {
	const r = await login('pemohon@example.test', 'SEED_REQUESTER_PASSWORD');
	checks.push('requester login');
	await r.page.goto(base + '/tiket/baru');
	await r.page.waitForLoadState('networkidle');
	await r.page.locator('select[name=service]').selectOption({ label: 'Infrastructure' });
	const title = 'Uji browser · koneksi jaringan ' + Date.now();
	await r.page.getByLabel('Subjek', { exact: true }).fill(title);
	await r.page
		.locator('textarea[name=description]')
		.fill(
			'Data uji fiktif: koneksi jaringan terputus pada perangkat contoh. Mohon pemeriksaan tim IT.'
		);
	await r.page.locator('input[type=file]').setInputFiles({
		name: 'evidence.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('Fictional error log for browser testing.')
	});
	await r.page.getByRole('button', { name: 'Periksa ringkasan' }).click();
	await r.page.getByRole('button', { name: 'Kirim tiket', exact: true }).click();
	await r.page.waitForURL(/\/tiket\/[0-9a-f-]+\?created=1/);
	await r.page.waitForLoadState('networkidle');
	assert((await r.page.locator('h1').textContent()) === title);
	const path = new URL(r.page.url()).pathname;
	checks.push('ticket creation and readable summary');
	// Authorized attachment download is exercised via authenticated HTTP to retain page location.
	const attachment = await r.page.locator('a[href^="/lampiran/"]').getAttribute('href');
	assert(attachment);
	const file = await r.context.request.get(base + attachment);
	assert.equal(file.status(), 200);
	assert((await file.text()).includes('Fictional error log'));
	checks.push('private attachment download');
	const a = await login('agen@example.test', 'SEED_AGENT_PASSWORD');
	await a.page.goto(base + path);
	await a.page.waitForLoadState('networkidle');
	await a.page.locator('select[name=agent]').selectOption({ label: 'Agen Contoh' });
	await a.page.getByRole('button', { name: 'Simpan penugasan' }).click();
	await success(a.page, 'Penugasan diperbarui');
	checks.push('agent assignment');
	await status(a.page, 'DIPROSES');
	await a.page.locator('textarea[name=body]').fill('PRIVATE_BROWSER_NOTE');
	await a.page.locator('input[name=internal]').check();
	await a.page.getByRole('button', { name: 'Simpan catatan internal' }).click();
	await success(a.page, 'Pesan tersimpan');
	await r.page.reload();
	await r.page.waitForLoadState('networkidle');
	assert(!(await r.page.content()).includes('PRIVATE_BROWSER_NOTE'));
	checks.push('internal-note privacy in rendered and serialized page');
	await a.page.locator('input[name=internal]').uncheck();
	await a.page.locator('textarea[name=body]').fill('Mohon kirim informasi perangkat contoh.');
	await a.page.getByRole('button', { name: 'Kirim balasan publik' }).click();
	await success(a.page, 'Pesan tersimpan');
	await status(a.page, 'MENUNGGU_PEMOHON');
	await r.page.reload();
	await r.page.locator('textarea[name=body]').fill('Perangkat contoh menggunakan koneksi Wi-Fi.');
	await r.page.getByRole('button', { name: 'Kirim balasan publik' }).click();
	await success(r.page, 'Pesan tersimpan');
	assert(await r.page.locator('.ticket-summary').getByText('Diproses', { exact: true }).count());
	checks.push('public reply resumes waiting ticket');
	await a.page.reload();
	await status(a.page, 'SELESAI', 'Konfigurasi jaringan contoh diperbaiki dan diverifikasi.');
	await r.page.reload();
	await status(r.page, 'DIPROSES', 'Kendala contoh masih muncul.');
	await a.page.reload();
	await status(a.page, 'SELESAI', 'Perbaikan kedua sudah diuji dengan pemohon contoh.');
	await r.page.reload();
	await status(r.page, 'DITUTUP');
	assert.equal(await r.page.locator('textarea[name=body]').count(), 0);
	checks.push('resolve, reopen, resolve, close and terminal state');
	const other = await login('pemohon-lain@example.test', 'SEED_REQUESTER_PASSWORD');
	const denied = await other.context.request.get(base + path);
	assert.equal(denied.status(), 404);
	assert.equal((await other.context.request.get(base + attachment)).status(), 404);
	assert.equal((await other.context.request.get(base + '/admin')).status(), 403);
	checks.push('cross-user guessed ticket and attachment denied; admin protected');
	await other.context.close();
	await r.page.goto(base + '/tiket');
	await r.page.getByRole('textbox', { name: 'Cari tiket' }).fill(title);
	await r.page.getByRole('button', { name: 'Terapkan' }).click();
	await r.page.waitForLoadState('networkidle');
	assert(new URL(r.page.url()).searchParams.get('q') === title);
	assert((await r.page.locator('.ticket-title:visible').count()) === 1);
	checks.push('search and URL filters');
	const csrf = await r.context.request.post(base + path + '?/status', {
		headers: { origin: 'https://evil.example' },
		form: { version: '1', status: 'DIPROSES', note: '' }
	});
	assert.equal(csrf.status(), 403);
	checks.push('CSRF denied');
	const admin = await login('admin@example.test', 'BOOTSTRAP_PASSWORD');
	await admin.page.goto(base + '/admin');
	await admin.page.waitForLoadState('networkidle');
	for (const tab of ['Layanan', 'Pengetahuan', 'Target & prioritas', 'Pengguna & tim'])
		await admin.page.getByRole('button', { name: tab, exact: true }).click();
	checks.push('admin screen and all sections');
	const suffix = Date.now().toString();
	async function submitAdmin(button: import('playwright').Locator, message: string) {
		await Promise.all([
			admin.page.waitForResponse(
				(response) => response.request().method() === 'POST' && response.url().includes('/admin')
			),
			button.click()
		]);
		await success(admin.page, message);
	}
	await admin.page.getByLabel('Nama tim baru', { exact: true }).fill('Tim Uji ' + suffix);
	await submitAdmin(
		admin.page.getByRole('button', { name: 'Tambah tim', exact: true }),
		'Tim tersimpan'
	);
	const team = admin.page
		.locator('details')
		.filter({ has: admin.page.locator('summary', { hasText: 'Tim Uji ' + suffix }) });
	await team.locator('summary').click();
	await team.getByLabel('Nama tim', { exact: true }).fill('Tim Uji ' + suffix + ' Baru');
	await submitAdmin(team.getByRole('button', { name: 'Simpan nama tim' }), 'Tim tersimpan');
	await admin.page
		.locator('summary')
		.filter({ hasText: 'Tim Uji ' + suffix + ' Baru' })
		.waitFor();
	const addUser = admin.page
		.locator('section.panel')
		.filter({ has: admin.page.getByRole('heading', { name: 'Tambah pengguna', exact: true }) });
	const newEmail = 'browser-' + suffix + '@example.test';
	const newPassword = crypto.randomUUID();
	const newName = 'Pengguna Uji ' + suffix;
	await addUser.getByLabel('Nama', { exact: true }).fill(newName);
	await addUser.getByLabel('Email', { exact: true }).fill(newEmail);
	await addUser.getByLabel('Departemen', { exact: true }).fill('Departemen Uji');
	await addUser.locator('input[name=password]').fill(newPassword);
	await submitAdmin(addUser.getByRole('button', { name: 'Simpan pengguna' }), 'Pengguna tersimpan');
	const freshContext = await browser.newContext();
	const fresh = await freshContext.newPage();
	watch(fresh);
	await fresh.goto(base + '/login');
	await fresh.getByLabel('Email', { exact: true }).fill(newEmail);
	await fresh.getByLabel('Kata sandi', { exact: true }).fill(newPassword);
	await fresh.getByRole('button', { name: 'Masuk ke portal' }).click();
	await fresh.waitForURL(base + '/');
	await fresh.getByRole('heading', { name: 'Antrean kosong' }).waitFor();
	const userRow = admin.page
		.locator('details')
		.filter({ has: admin.page.locator('summary', { hasText: newName }) });
	await userRow.locator('summary').click();
	await userRow.locator('input[name=active]').uncheck();
	await submitAdmin(userRow.getByRole('button', { name: 'Simpan pengguna' }), 'Pengguna tersimpan');
	assert.equal((await freshContext.request.get(base + '/', { maxRedirects: 0 })).status(), 303);
	await freshContext.close();
	checks.push(
		'admin user creation, empty state, deactivation and session invalidation; team creation and rename'
	);
	await admin.page.getByRole('button', { name: 'Layanan', exact: true }).click();
	const addService = admin.page
		.locator('section.panel')
		.filter({ has: admin.page.getByRole('heading', { name: 'Tambah layanan', exact: true }) });
	const serviceName = 'Layanan Uji ' + suffix;
	await addService.getByLabel('Nama layanan', { exact: true }).fill(serviceName);
	await addService
		.getByLabel('Penjelasan', { exact: true })
		.fill('Layanan fiktif untuk uji pengelolaan katalog portal.');
	await submitAdmin(
		addService.getByRole('button', { name: 'Simpan layanan' }),
		'Layanan tersimpan'
	);
	assert((await (await r.context.request.get(base + '/layanan')).text()).includes(serviceName));
	const serviceRow = admin.page
		.locator('details')
		.filter({ has: admin.page.locator('summary', { hasText: serviceName }) });
	await serviceRow.locator('summary').click();
	await serviceRow.locator('input[name=active]').uncheck();
	await submitAdmin(
		serviceRow.getByRole('button', { name: 'Simpan layanan' }),
		'Layanan tersimpan'
	);
	assert(!(await (await r.context.request.get(base + '/layanan')).text()).includes(serviceName));
	checks.push('catalog creation and deactivation');
	await admin.page.getByRole('button', { name: 'Pengetahuan', exact: true }).click();
	const addArticle = admin.page
		.locator('section.panel')
		.filter({ has: admin.page.getByRole('heading', { name: 'Tambah artikel', exact: true }) });
	const articleTitle = 'Panduan Uji ' + suffix;
	const slug = 'panduan-uji-' + suffix;
	await addArticle.getByLabel('Judul', { exact: true }).fill(articleTitle);
	await addArticle.getByLabel('Slug', { exact: true }).fill(slug);
	await addArticle
		.locator('textarea[name=body]')
		.fill(
			'Panduan uji fiktif untuk memverifikasi publikasi artikel. Ini adalah teks contoh tanpa data nyata.'
		);
	await submitAdmin(
		addArticle.getByRole('button', { name: 'Simpan artikel' }),
		'Artikel tersimpan'
	);
	assert.equal((await r.context.request.get(base + '/pengetahuan/' + slug)).status(), 404);
	const articleRow = admin.page
		.locator('details')
		.filter({ has: admin.page.locator('summary', { hasText: articleTitle }) });
	await articleRow.locator('summary').click();
	await articleRow.locator('input[name=published]').check();
	await submitAdmin(
		articleRow.getByRole('button', { name: 'Simpan artikel' }),
		'Artikel tersimpan'
	);
	assert.equal((await r.context.request.get(base + '/pengetahuan/' + slug)).status(), 200);
	checks.push('knowledge draft privacy and publication');

	const layoutResults = [];
	for (const width of [360, 768, 1024, 1440]) {
		await r.page.setViewportSize({ width, height: 900 });
		for (const route of [
			'/',
			'/tiket',
			'/layanan',
			'/tiket/baru',
			'/pengetahuan',
			path,
			'/profil',
			'/notifikasi'
		]) {
			await r.page.goto(base + route);
			await r.page.waitForLoadState('networkidle');
			const overflow = await r.page.evaluate(
				() => document.documentElement.scrollWidth > window.innerWidth
			);
			assert(!overflow, `Overflow ${width} ${route}`);
			const undersized = await r.page
				.locator(
					'a,button,input:not([type=hidden]):not([type=checkbox]),select,textarea,summary,label.checkbox'
				)
				.evaluateAll((elements) =>
					elements
						.filter((el) => {
							const rect = el.getBoundingClientRect();
							const style = getComputedStyle(el);
							return (
								rect.width > 0 &&
								rect.height > 0 &&
								style.visibility !== 'hidden' &&
								(rect.height < 43.5 || rect.width < 43.5)
							);
						})
						.map((el) => ({
							text: el.textContent?.slice(0, 60),
							tag: el.tagName,
							height: el.getBoundingClientRect().height,
							width: el.getBoundingClientRect().width
						}))
				);
			assert.equal(
				undersized.length,
				0,
				`Touch targets ${width} ${route}: ${JSON.stringify(undersized)}`
			);

			const scan = await new AxeBuilder({ page: r.page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze();
			layoutResults.push({
				width,
				route,
				violations: scan.violations.map((v) => ({
					id: v.id,
					impact: v.impact,
					nodes: v.nodes.map((n) => n.target)
				}))
			});
		}
		await r.page.goto(base + '/');
		await r.page.waitForLoadState('networkidle');
		await r.page.screenshot({ path: `artifacts/dashboard-${width}.png`, fullPage: true });
		if (width < 900) {
			await r.page.getByRole('button', { name: 'Buka navigasi' }).click();
			await r.page
				.getByRole('navigation', { name: 'Navigasi utama' })
				.getByRole('link', { name: /Katalog layanan/ })
				.click();
			await r.page.waitForURL(base + '/layanan');
			await r.page.getByRole('button', { name: 'Buka navigasi' }).click();
			await r.page.keyboard.press('Escape');
			assert.equal(
				await r.page.getByRole('button', { name: 'Buka navigasi' }).getAttribute('aria-expanded'),
				'false'
			);
		}
	}
	checks.push('8 screens at 360/768/1024/1440 without overflow; mobile navigation and Escape');
	await r.page.emulateMedia({ reducedMotion: 'reduce' });
	await r.page.goto(base + '/');
	await r.page.keyboard.press('Tab');
	const focused = await r.page.evaluate(() => ({
		tag: document.activeElement?.tagName,
		outline: getComputedStyle(document.activeElement!).outlineStyle
	}));
	assert(focused.outline !== 'none');
	checks.push('keyboard focus and reduced motion');
	await r.page.goto(base + '/tiket/baru');
	await r.page.locator('select[name=service]').selectOption({ label: 'Infrastructure' });
	await r.page.getByLabel('Subjek', { exact: true }).fill('Invalid attachment browser test');
	await r.page
		.locator('textarea[name=description]')
		.fill('Fictional testing description for invalid active attachment.');
	await r.page.locator('input[type=file]').setInputFiles({
		name: 'bad.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('<script>alert(1)</script>')
	});
	await r.page.getByRole('button', { name: 'Periksa ringkasan' }).click();
	await r.page.getByRole('button', { name: 'Kirim tiket', exact: true }).click();
	await r.page.getByRole('alert').waitFor();
	checks.push('upload failure state');
	await r.page.locator('form[action="/logout"] button').click();
	await r.page.waitForURL(base + '/login');
	checks.push('logout');
	await Bun.write(
		'artifacts/browser-results.json',
		JSON.stringify({ checks, errors, layouts: layoutResults }, null, 2)
	);
	const violations = layoutResults.filter((l) => l.violations.length);
	console.log(
		JSON.stringify(
			{ checks: checks.length, browserErrors: errors, accessibilityFailures: violations },
			null,
			2
		)
	);
	assert.equal(errors.length, 0);
	assert.equal(violations.length, 0);
	await a.context.close();
	await r.context.close();
	await admin.context.close();
} finally {
	await browser.close();
}
