import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { parseEnv } from 'node:util';
// A local portal .env takes precedence over unrelated shell credentials.
const local = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
export function setting(key: string) {
	if (
		process.env.NODE_ENV === 'test' &&
		key === 'DATABASE_URL' &&
		process.env.PORTAL_TEST_DATABASE_URL
	)
		return process.env.PORTAL_TEST_DATABASE_URL;
	if (process.env.NODE_ENV === 'test' && key === 'UPLOAD_DIR' && process.env.PORTAL_TEST_UPLOAD_DIR)
		return process.env.PORTAL_TEST_UPLOAD_DIR;
	return local[key] ?? process.env[key];
}
export function databaseUrl() {
	const value = setting('DATABASE_URL');
	if (!value || !/^itportal(?:_[a-z0-9_]+)?$/.test(new URL(value).pathname.slice(1)))
		throw new Error('Konfigurasi database khusus itportal diperlukan.');
	return value;
}
export const origin = setting('APP_ORIGIN') || 'http://localhost:5174';
export const uploadDir = resolve(setting('UPLOAD_DIR') || '.local/uploads');
for (const publicDir of [resolve('static'), resolve('public'), resolve('build/client')]) {
	const rel = relative(publicDir, uploadDir);
	if (!rel || (!rel.startsWith('..') && !isAbsolute(rel)))
		throw new Error('UPLOAD_DIR harus di luar direktori publik.');
}
export const production = setting('NODE_ENV') === 'production';
