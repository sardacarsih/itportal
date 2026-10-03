import { scope } from '$lib/server/portal';
import { db, rows, one, sql } from '$lib/server/db';
export const actions: import('./$types').Actions = {
	default: async ({ locals }) => {
		await db.execute(
			sql`UPDATE notifications SET read_at=now() WHERE user_id=${locals.user!.id}::uuid AND read_at IS NULL`
		);
		return { success: 'Notifikasi ditandai dibaca.' };
	}
};

export const load: import('./$types').PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const page = Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1));
	const pageSize = 20;
	const notifications = await rows<{
		id: string;
		ticket_id: string;
		body: string;
		read_at: Date | null;
		created_at: Date;
	}>(
		sql`SELECT n.id,n.ticket_id,n.body,n.read_at,n.created_at FROM notifications n JOIN tickets t ON t.id=n.ticket_id WHERE n.user_id=${user.id}::uuid AND ${scope(user)} ORDER BY n.created_at DESC,n.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
	);
	const total = Number(
		(
			await one<{ count: number }>(
				sql`SELECT count(*)::int AS count FROM notifications n JOIN tickets t ON t.id=n.ticket_id WHERE n.user_id=${user.id}::uuid AND ${scope(user)}`
			)
		)?.count || 0
	);
	return { notifications, total, page, pageSize };
};
