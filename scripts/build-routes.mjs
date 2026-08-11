/**
 * Mengambil geometri jalur angkutan umum Jakarta dari OSM.
 *
 *   node scripts/build-routes.mjs
 *
 * Keluaran: `static/data/routes.json` (aset statis, diambil MapLibre lewat URL) — satu FeatureCollection, tiap ruas
 * membawa properti `mode` (mrt | krl | lrt | brt).
 *
 * Relasi rute di OSM punya banyak varian: arah pergi dan pulang dipetakan
 * terpisah, dan satu koridor sering dipakai beberapa nomor trayek sekaligus.
 * Kalau semuanya digambar apa adanya, satu koridor tertumpuk belasan kali —
 * berat dan tidak menambah informasi apa pun. Karena itu ruas dideduplikasi
 * berdasarkan id way OSM: tiap potongan jalan digambar tepat sekali per moda.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BBOX = '-6.45,106.6,-6.02,107.1';

const ENDPOINTS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter'
];
const UA = 'SpotOn/0.1 (MAPID WebGIS Competition 2026; github.com/SpotOn)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, label) {
	let lastErr;
	for (let attempt = 0; attempt < 5; attempt++) {
		const url = ENDPOINTS[attempt % ENDPOINTS.length];
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': UA,
					accept: 'application/json'
				},
				body: new URLSearchParams({ data: query })
			});
			if (res.status === 429 || res.status === 504) {
				const wait = 8000 * (attempt + 1);
				console.log(`  (${label}) dibatasi laju, tunggu ${wait / 1000}s…`);
				await sleep(wait);
				continue;
			}
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			return await res.json();
		} catch (err) {
			lastErr = err;
			await sleep(5000 * (attempt + 1));
		}
	}
	throw lastErr ?? new Error(`Overpass gagal: ${label}`);
}

/** Urutan penting: yang digambar belakangan berada di atas. BRT paling padat,
    jadi ia digambar paling bawah supaya rel tidak tertutup. */
const MODES = [
	{
		key: 'brt',
		label: 'TransJakarta',
		query: `rel["route"="bus"]["operator"~"TransJakarta",i](${BBOX});`
	},
	{
		key: 'krl',
		label: 'KRL Commuterline',
		// route=train juga mencakup kereta jarak jauh dan barang; yang relevan bagi
		// pejalan kaki kota hanya layanan commuter.
		query: `rel["route"="train"]["operator"~"KAI Commuter|Kereta Commuter|KCI",i](${BBOX});`
	},
	{ key: 'lrt', label: 'LRT', query: `rel["route"="light_rail"](${BBOX});` },
	{ key: 'mrt', label: 'MRT', query: `rel["route"="subway"](${BBOX});` }
];

/** Douglas–Peucker sederhana; toleransi dalam derajat (±1e-4 ≈ 11 m). */
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

		// Dedup per id way: satu potongan jalan digambar sekali per moda, berapa pun
		// jumlah trayek dan arah yang melewatinya.
		const seen = new Set();
		const lines = [];
		let segments = 0;

		for (const rel of data.elements) {
			if (rel.type !== 'relation' || !rel.members) continue;
			for (const m of rel.members) {
				if (m.type !== 'way' || !m.geometry || m.geometry.length < 2) continue;
				if (m.role && m.role !== '') continue; // peron/halte, bukan ruas jalur
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
		console.log(`${data.elements.length} relasi → ${segments} ruas`);
		if (i < MODES.length - 1) await sleep(3500);
	}

	const fc = {
		type: 'FeatureCollection',
		meta: {
			source: 'OpenStreetMap contributors (ODbL) via Overpass API',
			note: 'Ruas dideduplikasi per id way OSM: satu potongan jalur digambar sekali per moda, meski dilewati banyak trayek dan dua arah.',
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
	console.log(`\n${features.length} moda · ${totalPts} titik tersimpan`);
	console.log(`→ ${dest}`);
}

main().catch((err) => {
	console.error('Gagal:', err.message);
	process.exit(1);
});
