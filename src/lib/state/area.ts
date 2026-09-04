import {
	EMPTY_TILE,
	assembleArea,
	decodeTile,
	modelZoom,
	tileUrl,
	tilesCovering,
	type DecodedTile,
	type RouteLine
} from '$lib/domain/basemap';
import type { AreaGeometry, BasemapSource, BasemapTiles, TileAddress } from '$lib/types';

/**
 * The basemap around one point, fetched, decoded and cut to the walking range.
 *
 * The fetching half of what `domain/basemap` computes, kept out of `AppState` so the
 * landing page can read an area too, without a map or an account behind it. Here
 * rather than in `map/`, because this owns what has been fetched, which is what this
 * directory is for, and because `map/` depends on this directory and not the other
 * way round.
 *
 * Tiles are kept per TILE rather than per area: a tile is a little wider than a walking
 * range and neighbouring cells share most of theirs, so moving one cell over reads at
 * most one or two new tiles. Bounded, because a tile decoded is a few megabytes of
 * coordinates and a reader who has crossed the city has no use for the first ones.
 */
export class AreaReader {
	#tiles = new Map<string, Promise<DecodedTile>>();
	static readonly MAX_TILES = 16;

	/** One tile, decoded, fetched at most once while it is remembered. */
	tile(source: BasemapSource, at: TileAddress): Promise<DecodedTile> {
		const url = tileUrl(source, at);
		const hit = this.#tiles.get(url);
		if (hit) return hit;
		const job = (async () => {
			const res = await fetch(url);
			// A tile with nothing in it is answered with nothing rather than with an
			// error, which is how MapLibre reads the same two statuses.
			if (res.status === 204 || res.status === 404) return EMPTY_TILE;
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return decodeTile(await res.arrayBuffer(), source, at);
		})();
		// Forgotten on failure, so the next area asks again rather than every later one
		// being answered by the request that failed.
		job.catch(() => this.#tiles.delete(url));
		this.#tiles.set(url, job);
		if (this.#tiles.size > AreaReader.MAX_TILES) {
			const oldest = this.#tiles.keys().next().value;
			if (oldest !== undefined) this.#tiles.delete(oldest);
		}
		return job;
	}

	/**
	 * Every source the style draws buildings from, each at the zoom it goes to, put
	 * together and cut to the disc. A source with nothing for this city answers with
	 * empty tiles, which cost a request each and nothing more.
	 */
	async read(
		basemap: BasemapTiles,
		centre: { lat: number; lon: number },
		radius: number,
		routes: RouteLine[],
		key: string
	): Promise<AreaGeometry> {
		let zoom = 0;
		const jobs: Promise<DecodedTile>[] = [];
		for (const source of basemap.sources) {
			const z = modelZoom(source);
			zoom = Math.max(zoom, z);
			for (const at of tilesCovering(centre, radius, z)) jobs.push(this.tile(source, at));
		}
		const tiles = await Promise.all(jobs);
		return assembleArea(tiles, centre, radius, routes, key, zoom);
	}
}
