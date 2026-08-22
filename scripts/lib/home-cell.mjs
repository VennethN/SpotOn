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

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle metres between two points. */
export function metres(aLat, aLon, bLat, bLon) {
	const dLat = rad(bLat - aLat);
	const dLon = rad(bLon - aLon);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

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
