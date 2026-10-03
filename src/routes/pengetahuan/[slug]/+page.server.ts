import { one, sql } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { Article } from '$lib/server/portal';
export const load: import('./$types').PageServerLoad = async ({ params }) => {
	const article = await one<Article>(
		sql`SELECT a.*,s.name AS service_name FROM articles a JOIN services s ON s.id=a.service_id WHERE a.slug=${params.slug} AND a.published=true`
	);
	if (!article) error(404, 'Artikel tidak ditemukan.');
	return { article };
};
