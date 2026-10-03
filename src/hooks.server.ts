import { error, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { sessionUser } from '$lib/server/auth';
import { origin } from '$lib/server/config';
export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (
		!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method) &&
		event.request.headers.get('origin') !== origin
	)
		error(403, 'Permintaan ditolak. Muat ulang halaman dari alamat portal.');
	event.locals.user =
		path === '/healthz' ? null : await sessionUser(event.cookies.get('portal_session'));
	const isPublic = path === '/login' || path === '/healthz' || path.startsWith('/auth/');
	if (!isPublic && !event.locals.user) redirect(303, '/login');
	if (
		event.locals.user &&
		(!event.locals.user.department || event.locals.user.department.trim() === '') &&
		path !== '/onboarding' &&
		path !== '/logout'
	)
		redirect(303, '/onboarding');
	if (path.startsWith('/admin') && event.locals.user?.role !== 'ADMIN')
		error(403, 'Hanya Admin yang dapat mengakses administrasi.');
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (path !== '/healthz') response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
export const handleError: HandleServerError = ({ error: eventError }) => {
	console.error(
		'Portal server error',
		eventError instanceof Error ? eventError.message : 'unknown'
	);
	return { message: 'Layanan sedang tidak tersedia. Coba lagi atau hubungi administrator portal.' };
};
