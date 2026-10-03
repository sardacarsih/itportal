import { redirect } from '@sveltejs/kit';
import { services, articles, createTicket, getTicket } from '$lib/server/portal';
import { ticketInput, fields, invalid, actionError } from '$lib/server/validation';
export const load: import('./$types').PageServerLoad = async ({ url, locals }) => {
	const related = url.searchParams.get('related') || '';
	if (related) await getTicket(locals.user!, related);
	const available = (await services()).filter(
		(s) => locals.user!.role !== 'AGEN' || locals.user!.teamIds.includes(s.team_id)
	);
	return {
		services: available,
		articles: await articles(new URLSearchParams()),
		key: crypto.randomUUID(),
		prefill: url.searchParams.get('service') || '',
		related
	};
};
export const actions: import('./$types').Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const input = ticketInput.safeParse(fields(form));
		if (!input.success) return invalid(input.error);
		let id: string;
		try {
			id = await createTicket(
				locals.user!,
				input.data,
				form.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0)
			);
		} catch (e) {
			return actionError(e);
		}
		redirect(303, `/tiket/${id}?created=1`);
	}
};
