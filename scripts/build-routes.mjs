/**
 * Fetches the geometry of Jakarta's public transit lines from OSM.
 *
 *   node scripts/build-routes.mjs
 *
 * Output: `static/data/routes.json` (a static asset, fetched by MapLibre over a URL) — a single
 * FeatureCollection where every segment carries a `mode` property (mrt | krl | lrt | brt).
 *
 * Route relations in OSM come in many variants: the outbound and inbound
 * directions are mapped separately, and one corridor is often shared by several
 * service numbers at once. Drawing all of them as-is stacks a single corridor a
 * dozen times over — heavy, and it adds no information whatsoever. Segments are
 * therefore deduplicated by OSM way id: each stretch of road is drawn exactly
 * once per mode.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass, sleep } from './lib/overpass.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BBOX = '-6.45,106.6,-6.02,107.1';


/** Order matters: whatever is drawn later sits on top. BRT is the densest,
    so it is drawn at the bottom to keep the rail lines from being buried. */
const MODES = [
	{
		key: 'brt',
		label: 'TransJakarta',
		query: `rel["route"="bus"]["operator"~"TransJakarta",i](${BBOX});`
	},
	{
		key: 'krl',
		label: 'KRL Commuterline',
		// route=train also covers long-distance and freight trains; the only thing
		// relevant to a city pedestrian is the commuter service.
		query: `rel["route"="train"]["operator"~"KAI Commuter|Kereta Commuter|KCI",i](${BBOX});`
	},
	{ key: 'lrt', label: 'LRT', query: `rel["route"="light_rail"](${BBOX});` },
	{ key: 'mrt', label: 'MRT', query: `rel["route"="subway"](${BBOX});` }
];

/** Plain Douglas–Peucker; tolerance in degrees (±1e-4 ≈ 11 m). */
function simplify(points, tol) {
	if (points.length < 3) return points;
	let maxDist = 0;
	let index = 0;
	const [ax, ay] = points[0];
	const [bx, by] = points[points.length - 1];
	for (let i = 1; i < points.length - 1; i++) {
		const [px, py] = points[i];
		const dx = bx - ax;
		const dy = by - ay;
		const denom = dx * dx + dy * dy;
		const t = denom === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / denom;
		const cx = ax + Math.max(0, Math.min(1, t)) * dx;
		const cy = ay + Math.max(0, Math.min(1, t)) * dy;
		const d = Math.hypot(px - cx, py - cy);
		if (d > maxDist) {
			maxDist = d;
			index = i;
		}
	}
	if (maxDist <= tol) return [points[0], points[points.length - 1]];
	return [
		...simplify(points.slice(0, index + 1), tol).slice(0, -1),
		...simplify(points.slice(index), tol)
	];
}

const r5 = (n) => Math.round(n * 1e5) / 1e5;

async function main() {
	const features = [];
	const summary = {};

	for (const [i, mode] of MODES.entries()) {
		process.stdout.write(`[${i + 1}/${MODES.length}] ${mode.label} … `);
		const data = await overpass(`[out:json][timeout:180];(${mode.query});out geom;`, mode.key);

		// Dedup by way id: each stretch of road is drawn once per mode, no matter
		// how many services and directions run over it.
		const seen = new Set();
		const lines = [];
		let segments = 0;

		for (const rel of data.elements) {
			if (rel.type !== 'relation' || !rel.members) continue;
			for (const m of rel.members) {
				if (m.type !== 'way' || !m.geometry || m.geometry.length < 2) continue;
				if (m.role && m.role !== '') continue; // platform/stop, not a line segment
				if (seen.has(m.ref)) continue;
				seen.add(m.ref);

				const pts = m.geometry.map((g) => [g.lon, g.lat]);
				const simplified = simplify(pts, 0.00015).map(([x, y]) => [r5(x), r5(y)]);
				if (simplified.length < 2) continue;

				lines.push(simplified);
				segments++;
			}
		}

		if (lines.length) {
			features.push({
				type: 'Feature',
				properties: { mode: mode.key, label: mode.label, segments },
				geometry: { type: 'MultiLineString', coordinates: lines }
			});
		}

		summary[mode.key] = segments;
		console.log(`${data.elements.length} relations → ${segments} segments`);
		if (i < MODES.length - 1) await sleep(3500);
	}

	const fc = {
		type: 'FeatureCollection',
		meta: {
			source: 'OpenStreetMap contributors (ODbL) via Overpass API',
			note: 'Segments are deduplicated by OSM way id: one stretch of line is drawn once per mode, even when many services and both directions run over it.',
			segments: summary,
			regenerate: 'node scripts/build-routes.mjs'
		},
		features
	};

	const dest = resolve(ROOT, 'static/data/routes.json');
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, JSON.stringify(fc));
	const totalPts = features.reduce(
		(a, f) => a + f.geometry.coordinates.reduce((b, l) => b + l.length, 0),
		0
	);
	console.log(`\n${features.length} modes · ${totalPts} points written`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
