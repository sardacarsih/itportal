import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, type SQL } from 'drizzle-orm';
import { databaseUrl } from './config';
import * as schema from './schema';
export const client = postgres(databaseUrl(), { max: 10, connect_timeout: 5, idle_timeout: 20 });
export const db = drizzle(client, { schema });
export type Executor = Pick<typeof db, 'execute'>;
export async function rows<T = Record<string, unknown>>(
	query: SQL,
	executor: Executor = db
): Promise<T[]> {
	return (await executor.execute(query)) as unknown as T[];
}
export async function one<T = Record<string, unknown>>(
	query: SQL,
	executor: Executor = db
): Promise<T | undefined> {
	return (await rows<T>(query, executor))[0];
}
export { sql };

process.on('sveltekit:shutdown', () => {
	void client.end({ timeout: 5 });
});
