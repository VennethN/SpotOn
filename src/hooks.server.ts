import { building } from '$app/environment';
import { SESSION_COOKIE, accountForToken } from '$lib/server/accounts';
import type { Handle } from '@sveltejs/kit';

/**
 * Who is asking, resolved once per request.
 *
 * Every endpoint that meters something and every page that has to know whether to draw
 * a sign-in link reads `locals.account`, so the session cookie is read in exactly one
 * place. Two places reading it would eventually be two places disagreeing about whether
 * somebody is signed in.
 *
 * Nothing is read while the site is being BUILT. The landing page is prerendered, which
 * means it is rendered by a build with no reader in front of it: there is no cookie to
 * read, and reaching for a database from a build machine would be asking a production
 * cluster to take part in a compile.
 *
 * A reader who is not signed in is not an error. It is the state the landing page and
 * the sign-in page are both drawn for, so this hook never throws and never redirects.
 * Where an account is REQUIRED is decided by the route that requires it.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.account = building
		? null
		: await accountForToken(event.cookies.get(SESSION_COOKIE));
	return resolve(event);
};
