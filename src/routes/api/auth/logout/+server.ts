import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, closeSession } from '$lib/server/accounts';
import { clearSessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * POST /api/auth/logout — sign out.
 *
 * Both halves, and both are needed. The cookie goes, which is what signs this browser
 * out, and the stored session goes with it, which is what makes the token in it useless
 * to anyone who kept a copy. Clearing only the cookie would leave a token that is still
 * good for thirty days sitting in whatever logged it.
 *
 * One session, not all of them. Somebody signing out of a shared machine is not asking
 * to be signed out of their phone.
 *
 * A POST rather than a GET, so nothing can sign a reader out by putting a URL in an
 * image tag on another page.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	await closeSession(cookies.get(SESSION_COOKIE));
	clearSessionCookie(cookies);
	return json({ account: null });
};
