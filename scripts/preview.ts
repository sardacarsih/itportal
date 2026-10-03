import { setting, origin } from '../src/lib/server/config';
const p = Bun.spawn(['bun', './build/index.js'], {
	env: {
		...process.env,
		HOST: '127.0.0.1',
		PORT: new URL(origin).port || '5174',
		ORIGIN: origin,
		BODY_SIZE_LIMIT: setting('BODY_SIZE_LIMIT') || '55M'
	},
	stdout: 'inherit',
	stderr: 'inherit'
});
process.on('SIGINT', () => p.kill('SIGINT'));
process.on('SIGTERM', () => p.kill('SIGTERM'));
process.exit(await p.exited);
