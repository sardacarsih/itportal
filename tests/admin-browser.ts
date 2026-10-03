import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { setting } from '../src/lib/server/config';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
try {
	await page.goto('http://localhost:5174/login');
	await page.getByLabel('Email', { exact: true }).fill('admin@example.test');
	await page.getByLabel('Kata sandi', { exact: true }).fill(setting('BOOTSTRAP_PASSWORD')!);
	await page.getByRole('button', { name: 'Masuk ke portal' }).click();
	await page.waitForURL('http://localhost:5174/');
	await page.goto('http://localhost:5174/admin');
	await page.waitForLoadState('networkidle');
	for (const width of [360, 768, 1024, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		for (const section of ['Pengguna & tim', 'Layanan', 'Pengetahuan', 'Target & prioritas']) {
			await page.getByRole('button', { name: section, exact: true }).click();
			assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
			const scan = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze();
			results.push({ width, section, violations: scan.violations.map((v) => v.id) });
			assert.equal(scan.violations.length, 0);
		}
	}
	await Bun.write(
		'artifacts/admin-accessibility.json',
		JSON.stringify({ results, errors }, null, 2)
	);
	assert.equal(errors.length, 0);
	console.log(
		'16 admin screen audits passed; no overflow, accessibility violations, or page errors.'
	);
} finally {
	await browser.close();
}
