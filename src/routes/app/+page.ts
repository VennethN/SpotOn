import type { Hex } from '$lib/types';
import type { PageLoad } from './$types';

/**
 * Indikator catchment diambil lewat endpoint API, bukan diimpor langsung, supaya
 * jalur datanya sama persis dengan saat sumbernya nanti diganti API MAPID.
 */
export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/catchments');
	if (!res.ok) throw new Error('Gagal memuat data catchment.');
	const data: { catchments: Hex[] } = await res.json();
	return { catchments: data.catchments };
};
