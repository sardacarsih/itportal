import { listTickets, services } from '$lib/server/portal';
export const load: import('./$types').PageServerLoad = async ({ locals, url }) => ({
	...(await listTickets(locals.user!, url.searchParams)),
	services: await services(),
	filters: Object.fromEntries(url.searchParams)
});
