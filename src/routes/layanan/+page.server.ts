import { services } from '$lib/server/portal';
export const load = async () => ({ services: await services() });
