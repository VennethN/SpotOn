import { redirect } from '@sveltejs/kit';
import { projectGrid, sampleEven, tradeShare } from '$lib/server/gridmap';
import { grid, loadHexes } from '$lib/server/source';
import type { PageServerLoad } from './$types';

/**
 * The account page needs an account, so it asks for one first.
 *
 * `next` points back here, so signing in from this page lands on this page rather than
 * on the map. Somebody who came to look at their plan came to look at their plan.
 *
 * IT ALSO CARRIES THE GRID, and the reason is the meter rather than the decoration. One
 * of the two things an account is charged for is opening a catchment, and "1,500 areas a
 * week" is an allowance nobody can picture. So the page draws the catchments: the real
 * 562, where they really are, coloured by the trade standing around each one. Both
 * figures on that picture are read from the grid on disk rather than written here, so a
 * rebuilt grid moves the picture with it.
 *
 * The one measure drawn is trade, and it is the one this product can paint without a
 * business type having been named. Nobody choosing a plan has said a word about coffee,
 * and a field coloured for one would be the same claim the app refuses to make on its
 * opening screen.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.account) redirect(303, '/signin?next=%2Faccount');

	const hexes = loadHexes();
	const plan = projectGrid(hexes);
	const trade = tradeShare(hexes);

	return {
		account: locals.account,
		/** The flat field: every cell, where it is, and what stands around it. */
		field: {
			pts: plan.pts.map((p, i) => ({ ...p, v: trade[i] })),
			height: plan.height,
			radius: plan.radius
		},
		/* The model's field. 91 values because that is what the scene's five rings hold,
		   sampled evenly across the ranking so the sample keeps the shape of the whole
		   grid rather than showing its best 91 cells. */
		model: sampleEven(trade, 91),
		cells: grid.hexes,
		/** How many of them the catalogue has actually read. The rest are drawn as the
		    absence they are, never as quiet streets. */
		measured: trade.filter((v) => v !== null).length
	};
};
