import { json } from '@sveltejs/kit';
import { hasDatabase } from '$lib/server/mongo';
import type { RequestHandler } from './$types';

/**
 * GET /api/account — who is signed in, and what is left.
 *
 * Read from `locals`, which `hooks.server.ts` filled in from the session cookie, so
 * this endpoint never touches the store itself and there is one reading of a session
 * per request rather than one per thing that asks.
 *
 * Signed out is `{ account: null }` and a 200, not a 401. Nobody being signed in is a
 * state the interface draws rather than an error it reports, and an endpoint that
 * answers "who am I" with a failure would make the sign-in page itself look broken.
 *
 * `demo` says outright that there is no database behind this, so the interface can say
 * so too rather than letting somebody find out when the process restarts.
 */
export const GET: RequestHandler = async ({ locals }) => {
	return json({ account: locals.account, demo: !hasDatabase() });
};
