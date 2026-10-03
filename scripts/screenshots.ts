import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { setting } from '../src/lib/server/config';

const origin = 'http://localhost:5174';
const directory = 'docs/screenshots';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1440, height: 1000 },
	deviceScaleFactor: 1
});
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
async function capture(route: string, filename: string) {
	await page.goto(origin + route);
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({
		path: `${directory}/${filename}.png`,
		fullPage: filename !== 'dashboard' && filename !== 'dashboard-mobile'
	});
}
try {
	await capture('/login', 'login');
	await page.getByLabel('Email', { exact: true }).fill('pemohon@example.test');
	await page.getByLabel('Kata sandi', { exact: true }).fill(setting('SEED_REQUESTER_PASSWORD')!);
	await page.getByRole('button', { name: 'Masuk ke portal' }).click();
	await page.waitForURL(origin + '/');
	await capture('/', 'dashboard');
	await capture('/layanan', 'katalog-layanan');
	await capture('/tiket/baru', 'buat-tiket');
	await page.setViewportSize({ width: 390, height: 844 });
	await capture('/', 'dashboard-mobile');
	if (errors.length) throw new Error(errors.join('\n'));
	console.log('Captured five demo screenshots without page errors.');
} finally {
	await context.close();
	await browser.close();
}
