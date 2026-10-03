import { rows, one, sql } from '$lib/server/db';
import { scope } from '$lib/server/portal';
export const load: import('./$types').LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	const notifications = user
		? await rows<{
				id: string;
				ticket_id: string;
				body: string;
				read_at: Date | null;
				created_at: Date;
			}>(
				sql`SELECT n.id,n.ticket_id,n.body,n.read_at,n.created_at FROM notifications n JOIN tickets t ON t.id=n.ticket_id WHERE n.user_id=${user.id}::uuid AND ${scope(user)} ORDER BY n.created_at DESC LIMIT 8`
			)
		: [];
	const unread = user
		? Number(
				(
					await one<{ count: number }>(
						sql`SELECT count(*)::int AS count FROM notifications n JOIN tickets t ON t.id=n.ticket_id WHERE n.user_id=${user.id}::uuid AND n.read_at IS NULL AND ${scope(user)}`
					)
				)?.count || 0
			)
		: 0;
	return { user, notifications, unread };
};
