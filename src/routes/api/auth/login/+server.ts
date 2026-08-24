import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import { signIn, signInDemo } from '$lib/server/accounts';
import { hasDatabase } from '$lib/server/mongo';
import { setSessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * POST /api/auth/login — sign in.
 *
 * Two doors, and which one is open is decided by whether a database is configured, not
 * by what the caller sends. With `MONGODB_URI` set this wants an address and a password.
 * Without it there is one account, it has no password, and a bare POST lands on it.
 *
 * The refusal is the same sentence whether the address is unknown or the password is
 * wrong, which is `signIn`'s rule rather than this file's. It is worth repeating here
 * because the temptation to be more helpful lives at exactly this layer: telling a
 * caller that an address is unknown turns the login form into a way of asking who has
 * an account.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!hasDatabase()) {
		const out = await signInDemo();
		if (!out.ok) return json({ error: out.error }, { status: 503 });
		setSessionCookie(cookies, out.signed, dev);
		return json({ account: out.signed.account });
	}

	let body: { email?: unknown; password?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const out = await signIn(body.email, body.password);
	if (!out.ok) {
		return json({ error: out.error }, { status: out.error === 'unavailable' ? 503 : 401 });
	}
	setSessionCookie(cookies, out.signed, dev);
	return json({ account: out.signed.account });
};
