import { json } from '@sveltejs/kit';
import { spendMeter } from '$lib/server/accounts';
import type { RequestHandler } from './$types';

/**
 * POST /api/analysis — spend one area or spot reading.
 *
 * Called when a reader opens a catchment or a unit BY HAND. That is the moment the
 * whole apparatus around one place runs: its competitors are located and named, the
 * stations it captures are read, the listings standing in it are gathered, its
 * timetables are added up into a curve. It is the second thing in this product that
 * costs something to produce, which is why it is the second thing metered.
 *
 * What it deliberately does not charge for: closing a card, reopening the place already
 * open, and every selection the app makes for itself. Two clicks on the same hexagon
 * are one reading of it, and a reader must never be charged for a move they did not
 * make.
 *
 * It takes no arguments. It could take the cell id, and then it would look like a
 * request for that cell's figures, which it is not: the figures are computed in the
 * browser from a grid it already has. This endpoint's whole job is the meter, so it
 * carries nothing that would suggest otherwise.
 *
 * 402 for an empty balance, and the balance travels with it. The interface needs the
 * figure to say what ran out, and it would otherwise have to make a second request to
 * find out what the first one already knew.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const account = locals.account;
	if (!account) return json({ error: 'signedout' }, { status: 401 });

	const out = await spendMeter(account.id, 'analysis');
	if (out.ok) return json({ account: out.account });
	if (out.reason === 'empty') return json({ error: 'empty', account: out.account }, { status: 402 });
	return json({ error: 'unavailable' }, { status: 503 });
};
