import { haversine } from '$lib/utils/geo';
import type { HexBase } from '$lib/types';

/**
 * Where a cell's competitors actually stand.
 *
 * The grid stores competitors as a COUNT per category, because a count is all the
 * score needs: supply is that count normalised and weighted by how busy the rivals
 * are. But a count is not what someone choosing a location wants to read. Nine
 * competitors clustered on one street with the far side of the cell empty is a
 * completely different proposition from nine spread evenly, and both are "9".
 *
 * So the points themselves are loaded separately (`static/data/pois/<cat>.json`,
 * written by `scripts/build-pois.mjs` from the very same MAPID point file
 * `join-mapid.mjs` counted) and matched back to a cell here, on demand, for one cell
 * at a time. This mirrors `domain/transit` exactly, for the same reason and by the
 * same route.
 *
 * ONLY THE MAPID SOURCE HAS POSITIONS
 *
 * `build-hexes.mjs` fetches OSM competitors with coordinates but keeps only the
 * per-cell counts, so nothing on disk knows where an OSM competitor stands. Drawing
 * the MAPID points while the OSM count is on screen would put one source's
 * competitors next to another source's number, which is exactly the kind of quiet
 * mismatch this codebase refuses elsewhere. With OSM selected the app draws nothing
 * and says why.
 */

export interface Competitor {
	/**
	 * The outlet's own name, or null when the dataset has none for it.
	 *
	 * Null is common and is not a fault: it means this outlet was surveyed without a
	 * name, and it is drawn as a mark with no label. It is NOT the same as the whole
	 * file having no names, which means the point file predates names being kept at
	 * all — `meta.named` on the file is what tells those two apart.
	 */
	name: string | null;
	lat: number;
	lon: number;
	/** Metres from the cell centre — filled in when matched to a cell. */
	distance: number;
}

/** The on-disk shape: a flat [lat, lon] pair, with the name appended only when there
    is one, because this file carries thousands of them. */
type RawPoint = [number, number] | [number, number, string];

export interface CompetitorFile {
	meta: {
		cat: string;
		count: number;
		/** How many of `count` carry a name. Zero for a file written before names were kept. */
		named: number;
		/** Cities whose MAPID dataset was read. Absent from this list means NOT CHECKED. */
		coverage: string[];
	};
	points: RawPoint[];
}

export function parseCompetitors(file: CompetitorFile): Array<Omit<Competitor, 'distance'>> {
	return file.points.map(([lat, lon, name]) => ({ lat, lon, name: name ?? null }));
}

/**
 * The competitors one cell captures, nearest first.
 *
 * The same test the grid used when it counted them: distance from the CELL CENTRE,
 * within the walking radius. Measuring any other way would return a different set
 * from the one the score was computed on, and the map would quietly disagree with
 * the panel beside it.
 */
export function capturedCompetitors(
	cell: Pick<HexBase, 'lat' | 'lon'>,
	points: Array<Omit<Competitor, 'distance'>>,
	radiusM: number
): Competitor[] {
	const out: Competitor[] = [];
	// A cheap box test before the trigonometry, as in `capturedStops`: 0.012° is
	// ~1.3 km, comfortably wider than the walking radius, and it discards nearly every
	// point in the city immediately. This matters more here than it does for the
	// stops, because a category can carry 3,700 points against transit's 1,100.
	const box = 0.012;
	for (const p of points) {
		if (Math.abs(p.lat - cell.lat) > box || Math.abs(p.lon - cell.lon) > box) continue;
		const distance = haversine(cell.lat, cell.lon, p.lat, p.lon);
		if (distance <= radiusM) out.push({ ...p, distance });
	}
	return out.sort((a, b) => a.distance - b.distance);
}
