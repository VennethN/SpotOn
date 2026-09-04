import type { Hex } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * The catchment indicators are fetched through the API endpoint rather than
 * imported directly, so the data path is exactly the same once the source is
 * swapped for the MAPID API.
 */
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/catchments');
	if (!res.ok) throw new Error('Failed to load catchment data.');
	const data: { catchments: Hex[] } = await res.json();
	return { catchments: data.catchments };
};
