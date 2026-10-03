import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from 'playwright';
import { origin } from '../src/lib/server/config';
import { createSession, revoke } from '../src/lib/server/auth';
import { one, sql, client } from '../src/lib/server/db';
import { mkdir } from 'node:fs/promises';
const user = await one<{ id: string }>(
	sql`SELECT id FROM users WHERE email='pemohon@example.test'`
);
if (!user) throw new Error('Fictional requester required');
const token = await createSession(user.id);
await mkdir('artifacts', { recursive: true });
const chrome = await launch({
	chromePath: chromium.executablePath(),
	chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
});
const results = [];
try {
	for (const route of ['/', '/tiket', '/tiket/baru']) {
		const result = await lighthouse(origin + route, {
			port: chrome.port,
			output: 'json',
			onlyCategories: ['performance', 'accessibility'],
			extraHeaders: { Cookie: 'portal_session=' + token },
			disableStorageReset: true,
			logLevel: 'error'
		});
		if (!result) throw new Error('No Lighthouse result');
		const name = route === '/' ? 'dashboard' : route.slice(1).replaceAll('/', '-');
		await Bun.write('artifacts/lighthouse-' + name + '.json', JSON.stringify(result.lhr, null, 2));
		const summary = {
			route,
			performance: (result.lhr.categories.performance.score ?? 0) * 100,
			accessibility: (result.lhr.categories.accessibility.score ?? 0) * 100,
			lcp: result.lhr.audits['largest-contentful-paint'].numericValue,
			cls: result.lhr.audits['cumulative-layout-shift'].numericValue,
			finalUrl: result.lhr.finalDisplayedUrl
		};
		results.push(summary);
		console.log(JSON.stringify(summary));
	}
	await Bun.write(
		'artifacts/lighthouse-summary.json',
		JSON.stringify(
			{
				conditions:
					'Lighthouse default mobile simulated throttling, headless Chromium, local Bun production bundle, fictional persisted requester data, authenticated cookie',
				results
			},
			null,
			2
		)
	);
} finally {
	await chrome.kill();
	await revoke(token);
	await client.end();
}
