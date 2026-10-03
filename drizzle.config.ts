import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/lib/server/config';
export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './drizzle-generated',
	dialect: 'postgresql',
	dbCredentials: { url: databaseUrl() }
});
