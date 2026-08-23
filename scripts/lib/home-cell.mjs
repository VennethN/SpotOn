/**
 * Which catchment a single field record belongs to.
 *
 * ONE RECORD, ONE CELL, and that is the whole reason this is a shared module rather
 * than a loop inside whichever script needed it first. `join-missions.mjs` counts these
 * records into the grid and `build-field.mjs` writes the very same records out for the
 * app to list. If the two decided membership separately, the card would one day list a
 * receipt the count above it did not include, and nothing would say so.
 *
 * The rule is `domain/units`': the nearest cell centre within one walking radius, and
 * nothing at all if there is no centre in range. Deliberately NOT `join-property.mjs`'
 * rule, which counts a listing into every catchment that reaches it — that is right for
 * a density and wrong for a list, because the interface names these records and the
 * same receipt in five catchments reads as five receipts.
 */

/**
 * The distance test is `lib/geo`'s, not this file's own.
 *
 * It had its own, opening `const R = 6_371_000`, which was a THIRD earth in a project
 * that also carried 6371008.8 in the joins and 6378137 in `src/lib/utils/geo.ts` — the
 * one the browser measures with. That matters here more than anywhere: a record's home
 * cell is decided by this function and the card that lists it is drawn in the browser,
 * so the two have to agree about which cell a record on the line belongs to. See the
 * note at the top of `lib/geo.mjs` for what the same gap cost the property and
 * competitor counts before it was closed.
 */
import { haversine } from './geo.mjs';

/** Great-circle metres between two points, re-exported under this module's own name so
    the callers that already ask it for a distance keep working. */
export const metres = haversine;

/**
 * Groups records by their home cell.
 *
 * A flat scan over every centre per record. A thousand records against 562 centres is
 * half a million distance tests, which is nothing, and a spatial index here would be a
 * structure to keep correct in exchange for milliseconds nobody is waiting on.
 *
 * Returns the grouping plus how many records reached no cell at all, because that
 * number is a finding: it is the share of a bounding box that the transit grid does not
 * cover, and every script using this reports it rather than letting records vanish.
 */
export function assignHomeCells(records, cells, radius) {
	const byCell = new Map();
	let outside = 0;
	for (const rec of records) {
		let best = null;
		let bestD = Infinity;
		for (const c of cells) {
			const d = metres(rec.lat, rec.lon, c.lat, c.lon);
			if (d < bestD) {
				bestD = d;
				best = c;
			}
		}
		if (!best || bestD > radius) {
			outside++;
			continue;
		}
		if (!byCell.has(best.id)) byCell.set(best.id, []);
		byCell.get(best.id).push({ ...rec, distance: Math.round(bestD) });
	}
	return { byCell, outside };
}
