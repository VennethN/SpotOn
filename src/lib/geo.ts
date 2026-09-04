import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

const EARTH_R = 6378137;

/**
 * Poligon lingkaran geodesik — catchment digambar pada skala sebenarnya di
 * permukaan bumi, bukan sebagai lingkaran berjari-jari piksel yang ikut mengecil
 * saat zoom. Radius berjalan kaki hanya bermakna kalau ukurannya benar.
 */
export function circlePolygon(
	lon: number,
	lat: number,
	radiusMeters: number,
	steps = 96
): Polygon {
	const coords: [number, number][] = [];
	const latRad = (lat * Math.PI) / 180;
	const dLat = (radiusMeters / EARTH_R) * (180 / Math.PI);
	const dLon = dLat / Math.cos(latRad);
	for (let i = 0; i <= steps; i++) {
		const theta = (i / steps) * 2 * Math.PI;
		coords.push([lon + dLon * Math.cos(theta), lat + dLat * Math.sin(theta)]);
	}
	return { type: 'Polygon', coordinates: [coords] };
}

/**
 * Sebaran titik pesaing di dalam catchment memakai spiral Fibonacci.
 *
 * Jumlahnya nyata (hasil hitung OSM), posisi individualnya ilustratif — sebaran
 * merata dipilih supaya tidak ada pola yang tampak bermakna padahal bukan.
 */
export function scatterPoints(
	lon: number,
	lat: number,
	radiusMeters: number,
	count: number,
	seedProps: Record<string, unknown> = {}
): Feature<Point>[] {
	const out: Feature<Point>[] = [];
	const n = Math.min(60, count);
	if (n <= 0) return out;
	const latRad = (lat * Math.PI) / 180;
	for (let i = 0; i < n; i++) {
		const angle = i * 2.399963; // sudut emas
		const r = radiusMeters * Math.sqrt((i + 0.5) / n) * 0.92;
		const dLat = ((r * Math.sin(angle)) / EARTH_R) * (180 / Math.PI);
		const dLon = ((r * Math.cos(angle)) / (EARTH_R * Math.cos(latRad))) * (180 / Math.PI);
		out.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [lon + dLon, lat + dLat] },
			properties: { ...seedProps }
		});
	}
	return out;
}

export const emptyFC = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Kotak batas seluruh titik, dengan sedikit ruang napas. */
export function boundsOf(points: Array<{ lon: number; lat: number }>, padDeg = 0.012) {
	const lons = points.map((p) => p.lon);
	const lats = points.map((p) => p.lat);
	return [
		[Math.min(...lons) - padDeg, Math.min(...lats) - padDeg],
		[Math.max(...lons) + padDeg, Math.max(...lats) + padDeg]
	] as [[number, number], [number, number]];
}
