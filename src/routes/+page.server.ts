import { dashboard } from '$lib/server/portal';
export const load: import('./$types').PageServerLoad = ({ locals }) => dashboard(locals.user!);
