import { json } from '@sveltejs/kit';
import { isPackKey, isPlanKey } from '$lib/domain/plans';
import { buyPack, changePlan } from '$lib/server/accounts';
import type { RequestHandler } from './$types';

/**
 * POST /api/billing — change tier, or buy a top-up.
 *
 * Two things an account can buy and one endpoint, because they are the same
 * transaction with a different line on it: something is paid for and the allowance
 * changes. `{ plan }` moves onto a tier, `{ pack }` adds credits that do not expire.
 *
 * THERE IS NO PAYMENT HERE, and the page that calls it says so on screen. Standing in a
 * card form that goes nowhere would be worse than an honest button: it would ask for a
 * number nobody is going to charge, in a product whose whole claim is that it does not
 * put things in front of a reader that are not what they look like. Everything that
 * FOLLOWS a payment is real and is in `server/accounts`, so the day a processor is
 * wired up it calls the same two functions from its webhook and nothing below this
 * line changes.
 *
 * Signed out is refused rather than served. Every other endpoint here can answer for
 * nobody; this one is about an account by definition.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const account = locals.account;
	if (!account) return json({ error: 'signedout' }, { status: 401 });

	let body: { plan?: unknown; pack?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	/* One or the other, never both in one request. A body carrying a plan AND a pack has
	   two prices and one confirmation, and whichever this file happened to read first
	   would be the one the reader was charged for. */
	if (body.plan !== undefined && body.pack !== undefined) {
		return json({ error: 'invalid' }, { status: 400 });
	}

	if (isPlanKey(body.plan)) {
		const next = await changePlan(account.id, body.plan);
		return next ? json({ account: next }) : json({ error: 'unavailable' }, { status: 503 });
	}

	if (isPackKey(body.pack)) {
		const next = await buyPack(account.id, body.pack);
		return next ? json({ account: next }) : json({ error: 'unavailable' }, { status: 503 });
	}

	return json({ error: 'invalid' }, { status: 400 });
};
