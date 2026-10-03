import { json } from '@sveltejs/kit';
import { db, sql } from '$lib/server/db';
export async function GET() {
	try {
		await db.execute(sql`SELECT 1 FROM portal_migrations LIMIT 1`);
		return json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return json({ status: 'unavailable' }, { status: 503 });
	}
}
