import { redirect } from '@sveltejs/kit';
import { revoke } from '$lib/server/auth';
export async function POST({ cookies }: import('./$types').RequestEvent) {
	await revoke(cookies.get('portal_session'));
	cookies.delete('portal_session', { path: '/' });
	redirect(303, '/login');
}
