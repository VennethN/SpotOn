import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import { register } from '$lib/server/accounts';
import { setSessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * POST /api/auth/register — create an account, and be signed in on it.
 *
 * Signed in on the way out rather than sent back to the login form. Somebody who has
 * just proved they know the password by choosing it does not need to prove it again in
 * the next request, and the form that would ask them to is where the two halves of a
 * sign-up come apart.
 *
 * Every new account starts on the free tier. Nothing here can put an account on a paid
 * one, and that is the point: the only path onto a paid tier is the billing endpoint,
 * so the day a payment processor stands in front of it there is no second way past.
 *
 * With no database this creates nothing. It signs the caller in on the demo account,
 * the same as the login endpoint, because in demo mode there is one account and a form
 * that appeared to make a second one would be lying about what it did.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: { email?: unknown; password?: unknown; name?: unknown };
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const out = await register(body.email, body.password, body.name);
	if (!out.ok) {
		const status = out.error === 'taken' ? 409 : out.error === 'unavailable' ? 503 : 400;
		return json({ error: out.error }, { status });
	}
	setSessionCookie(cookies, out.signed, dev);
	return json({ account: out.signed.account });
};
