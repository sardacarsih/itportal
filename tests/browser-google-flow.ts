import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = 'http://localhost:5174';
const artifactsDir = 'artifacts';
await mkdir(artifactsDir, { recursive: true });

console.log('1. Starting preview server on ' + origin + '...');
const server = Bun.spawn(['bun', 'scripts/preview.ts'], {
	env: { ...process.env, GOOGLE_MOCK: 'true' },
	stdout: 'pipe',
	stderr: 'inherit'
});

// Wait until server is reachable
let ready = false;
for (let i = 0; i < 30; i++) {
	try {
		const res = await fetch(origin + '/healthz');
		if (res.ok) {
			ready = true;
			break;
		}
	} catch {
		await Bun.sleep(500);
	}
}

if (!ready) {
	server.kill();
	throw new Error('Preview server failed to start within 15 seconds.');
}
console.log('Preview server is UP!');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
	console.log('2. Visiting login page...');
	await page.goto(origin + '/login');
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${artifactsDir}/1-login-page.png`, fullPage: true });

	const googleBtn = page.getByRole('link', { name: /Daftar \/ Masuk dengan Google/i });
	await assert(await googleBtn.isVisible(), 'Google button should be visible');

	console.log('3. Clicking Google login/register button...');
	await googleBtn.click();
	await page.waitForURL(
		(url) => url.pathname.includes('/mock') || url.pathname.includes('/onboarding')
	);
	await page.waitForLoadState('networkidle');

	console.log('Current URL after click:', page.url());
	await page.screenshot({ path: `${artifactsDir}/2-google-mock-consent.png`, fullPage: true });

	// Simulate selecting a new Google account
	const newEmail = `user.test.${Date.now()}@organisasi.id`;
	const newName = 'Ratna Kartika';

	await page.locator('input[name=name]').fill(newName);
	await page.locator('input[name=email]').fill(newEmail);
	await page.getByRole('button', { name: /Lanjutkan dengan Akun Ini/i }).click();

	console.log('4. Waiting for redirect to /onboarding...');
	await page.waitForURL(origin + '/onboarding');
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${artifactsDir}/3-onboarding-step.png`, fullPage: true });

	// Verify page title and copy
	const heading = await page.locator('h2').textContent();
	assert(heading?.includes('Lengkapi Profil'), 'Should be on onboarding page');

	console.log('5. Testing route guard: Attempting to visit / before choosing department...');
	await page.goto(origin + '/');
	await page.waitForLoadState('networkidle');
	assert(page.url().includes('/onboarding'), 'Route guard must redirect back to /onboarding');

	console.log('6. Selecting department and completing onboarding...');
	await page.locator('select[name=department]').selectOption('Keuangan & Akuntansi');
	await page.getByRole('button', { name: /Simpan & Lanjutkan ke Portal/i }).click();

	console.log('7. Verifying arrival at dashboard (/)...');
	await page.waitForURL(origin + '/');
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${artifactsDir}/4-dashboard-success.png`, fullPage: true });

	console.log('8. Verifying user profile display...');
	await page.goto(origin + '/profil');
	await page.waitForLoadState('networkidle');
	await page.screenshot({ path: `${artifactsDir}/5-profile-verified.png`, fullPage: true });

	const deptInput = await page.locator('input[name=department]').inputValue();
	assert.equal(deptInput, 'Keuangan & Akuntansi', 'Department in profile must match chosen option');

	const nameInput = await page.locator('input[name=name]').inputValue();
	assert.equal(nameInput, newName, 'Name in profile must match Google name');

	console.log('ALL GOOGLE REGISTRATION & ONBOARDING BROWSER CHECKS PASSED SUCCESSFULLY!');
} finally {
	await context.close();
	await browser.close();
	server.kill('SIGTERM');
}
