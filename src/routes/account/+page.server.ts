import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * The account page needs an account, so it asks for one first.
 *
 * `next` points back here, so signing in from this page lands on this page rather than
 * on the map. Somebody who came to look at their plan came to look at their plan.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.account) redirect(303, '/signin?next=%2Faccount');
	return { account: locals.account };
};
