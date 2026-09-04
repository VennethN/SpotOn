import { redirect } from '@sveltejs/kit';
import { hasDatabase } from '$lib/server/mongo';
import type { PageServerLoad } from './$types';

/**
 * The sign-in page, and where it sends somebody who is already signed in.
 *
 * `next` is followed rather than trusted: only a path on this site, never a full URL.
 * A redirect target read straight off the query string is the standard way a login page
 * becomes a way of bouncing somebody to another site with SpotOn's name on the link
 * they clicked.
 *
 * `demo` decides which door this page draws, and it is read here rather than guessed in
 * the browser. There is nothing secret in it: it says whether a database is configured,
 * which the reader can see anyway the moment they are let in without a password.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.account) redirect(303, next);
	return { demo: !hasDatabase(), next };
};

/** A path on this site, starting with exactly one slash. Anything else becomes the map. */
function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/app';
	return raw;
}
