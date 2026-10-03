import { articles, services } from '$lib/server/portal';
export const load: import('./$types').PageServerLoad = async ({ url }) => ({
	articles: await articles(url.searchParams),
	services: await services(),
	filters: Object.fromEntries(url.searchParams)
});
