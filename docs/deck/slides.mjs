/**
 * The slides. `renderDeck(facts, assets)` returns one self-contained HTML page,
 * one <section class="slide"> per page, which `build.mjs` prints to PDF.
 *
 * Nothing here carries a figure of its own: every count, score, name and price is
 * read off `facts`, which `build.mjs` computes from the grid and the engine. The
 * words are the product's where the product has them (the landing page's headings,
 * Tapak's own sentences, the card's labels), and follow its writing rules where they
 * are new: no em dash, no semicolon, say what a thing does.
 */

const esc = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => Number(v).toLocaleString('en-US');

/** Rupiah, written short the way `i18n/en.ts` writes it: 45000000 → Rp 45m. */
function rp(v) {
	const abs = Math.abs(v);
	const [value, suffix] =
		abs >= 1e9 ? [v / 1e9, 'bn'] : abs >= 1e6 ? [v / 1e6, 'm'] : abs >= 1e3 ? [v / 1e3, 'k'] : [v, ''];
	const r = Math.round(value * 10) / 10;
	return `Rp ${Number.isInteger(r) ? r.toLocaleString('en-US') : r.toFixed(1)}${suffix}`;
}

/* ── marks and figures ─────────────────────────────────────────────────── */

/** The SpotOn mark: a lot with its corner clipped. Same ratios as `BrandMark`. */
const brandMark = (size) =>
	`<span class="bm" style="--size:${size}px;--stroke:${Math.max(1.5, size * 0.115)}px;--radius:${Math.max(3, size * 0.23)}px" aria-hidden="true"></span>`;

const brandChip = (cls = '') =>
	`<span class="brandchip material ${cls}">${brandMark(15)}<span>SpotOn</span></span>`;

/** Tapak: the white scale figure, standing or mid-stride. Same drawing as `TapakFigure`. */
function tapak(size, walking = false) {
	const leg = (x, deg) => `transform="rotate(${walking ? deg : 0} ${x + 1.25} 20)"`;
	const arm = (x, deg) => `transform="rotate(${walking ? deg : 0} ${x + 1.05} 12)"`;
	return `<svg class="tapak" width="${size}" height="${size * 1.32}" viewBox="0 0 26 34" aria-hidden="true">
<ellipse cx="13" cy="32.4" rx="7.5" ry="1.5" fill="rgba(15,20,30,0.18)"/>
<g stroke="rgba(20,24,32,0.22)" stroke-width="0.6">
<rect x="10.6" y="20" width="2.5" height="11.6" rx="1.2" fill="#e4e1db" ${leg(10.6, 11)}/>
<rect x="13" y="20" width="2.5" height="11.6" rx="1.2" fill="#d3d0ca" ${leg(13, -13)}/>
<rect x="7.6" y="11.6" width="2.1" height="8.4" rx="1" fill="#edeae5" ${arm(7.6, -9)}/>
<rect x="16.3" y="11.6" width="2.1" height="8.4" rx="1" fill="#d3d0ca" ${arm(16.3, 10)}/>
<rect x="9" y="9.4" width="8" height="12.4" rx="4" fill="#f2f0ec"/>
<circle cx="13" cy="5.4" r="3.6" fill="#eae7e1"/>
</g></svg>`;
}

/** The chrome glyphs, on `Glyph`'s grid at `Glyph`'s stroke. */
const GLYPH = {
	price: '<path d="M8.4 1.9H14v5.6l-6.5 6.5a1 1 0 0 1-1.4 0l-4.2-4.2a1 1 0 0 1 0-1.4Z"/><circle cx="11.1" cy="4.9" r="1.05"/>',
	market: '<path d="M2 6.2h12v7.3H2Z"/><path d="M1.4 3.1h13.2L14 6.2H2Z"/><path d="M6.4 13.5V9.4h3.2v4.1"/>',
	hours: '<circle cx="8" cy="8" r="6.1"/><path d="M8 4.3V8l2.6 1.6"/>',
	units: '<path d="M2.4 4.4h11.2M2.4 8h11.2M2.4 11.6h7.4"/>',
	sign: '<path d="M2.3 2.6h11.4v6.1H2.3Z"/><path d="M8 8.7v4.7M5.6 13.4h4.8"/><path d="M4.7 5.6h6.6"/>',
	field: '<path d="M4.2 2.4h7.6v11.2H4.2Z"/><path d="M6.3 5.6h3.4M6.3 8h3.4M6.3 10.4h2"/>',
	rivals: '<rect x="2.2" y="2.2" width="5" height="5" rx="0.6"/><rect x="8.8" y="8.8" width="5" height="5" rx="0.6"/><path d="M8.8 4.7h5M2.2 11.3h5"/>',
	score: '<path d="M2.1 11.7a5.9 5.9 0 1 1 11.8 0"/><path d="M8 11.7 11 7.2"/><circle cx="8" cy="11.7" r="0.65" fill="currentColor" stroke="none"/>',
	info: '<circle cx="8" cy="8" r="6.1"/><path d="M8 7.4v3.6"/><circle cx="8" cy="5.1" r="0.45" fill="currentColor" stroke="none"/>',
	transit:
		'<rect x="4" y="1.9" width="8" height="9.4" rx="2"/><path d="M4 7.1h8M6.2 14.1l-1.4 0M11.2 14.1l-1.4 0M6.4 11.3 4.8 14.1M9.6 11.3l1.6 2.8"/><circle cx="6.4" cy="9.2" r="0.5" fill="currentColor" stroke="none"/><circle cx="9.6" cy="9.2" r="0.5" fill="currentColor" stroke="none"/>',
	cell: '<path d="M8 1.6 13.6 4.8v6.4L8 14.4 2.4 11.2V4.8Z"/>',
	arrow: '<path d="M3 8h10M9 4l4 4-4 4"/>'
};
const glyph = (name, size = 22) =>
	`<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${(1.3 * 13) / size + 0.35}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[name]}</svg>`;

/** One drawing per business type, from `CategoryGlyph`. */
const CAT_GLYPH = {
	kopi: '<path d="M3.1 6h7.6v3.5a3.2 3.2 0 0 1-3.2 3.2H6.3a3.2 3.2 0 0 1-3.2-3.2Z"/><path d="M10.7 6.9h1.1a2 2 0 0 1 0 4h-1.1"/><path d="M5.6 4V2.5M8.2 4V2.5"/>',
	minuman: '<path d="M4 6h8l-.9 6.6a1 1 0 0 1-1 .9H5.9a1 1 0 0 1-1-.9Z"/><path d="M3.1 6h9.8"/><path d="M9.7 6 11.9 2.7"/>',
	roti: '<path d="M2.5 12.4V9.2a5.5 5.5 0 0 1 11 0v3.2Z"/><path d="M5.9 5.3 4.6 7.7M9.5 4.9 8.2 7.3"/>',
	warteg: '<path d="M2.6 11.2a5.4 5.4 0 0 1 10.8 0Z"/><path d="M1.5 11.2h13"/><path d="M8 5.8V4.4"/>',
	cepatsaji:
		'<path d="M2.6 6.7a5.4 5.4 0 0 1 10.8 0Z"/><path d="M2.7 8.7h10.6"/><path d="M2.6 10.5h10.8a2.4 2.4 0 0 1-2.4 2.4H5a2.4 2.4 0 0 1-2.4-2.4Z"/>',
	mie: '<path d="M2.3 8.3h11.4a5.7 5.7 0 0 1-11.4 0Z"/><path d="M8.5 7.5 13.4 3.3M6.7 7.5 11.6 3.3"/>',
	seafood:
		'<ellipse cx="6.4" cy="8" rx="4.6" ry="3.2"/><path d="M11 8 14.5 5v6Z"/><circle cx="4.2" cy="7.2" r="0.5" fill="currentColor" stroke="none"/>',
	restoasing:
		'<path d="M3.4 2.4v3.5a1.8 1.8 0 0 0 3.6 0V2.4"/><path d="M5.2 2.4v3.5M5.2 7.7v5.9"/><path d="M11.4 13.6V2.4c1.6 1.1 2.4 3 2.4 5 0 1.6-1 2.6-2.4 2.6"/>',
	minimarket:
		'<path d="M2.3 5.9h11.4l-1.1 6.2a1.4 1.4 0 0 1-1.4 1.2H4.8a1.4 1.4 0 0 1-1.4-1.2Z"/><path d="M5.8 5.9 8 2.7l2.2 3.2"/><path d="M6.4 8.6v2.3M9.6 8.6v2.3"/>',
	kelontong: '<path d="M2.5 2.7h11v10.8h-11Z"/><path d="M2.5 6.3h11M2.5 9.9h11"/><path d="M5.6 2.7v3.6M10 6.3v3.6M6.8 9.9v3.6"/>',
	laundry:
		'<path d="M2.9 2.5h10.2v11h-10.2Z"/><path d="M2.9 5.5h10.2"/><circle cx="11.2" cy="4" r="0.55" fill="currentColor" stroke="none"/><circle cx="8" cy="9.6" r="2.8"/><circle cx="8" cy="9.6" r="1"/>',
	bengkel:
		'<path d="M14.5 5.8a3.6 3.6 0 0 1-4.8 4.1l-5 5a1.6 1.6 0 0 1-2.3-2.3l5-5a3.6 3.6 0 0 1 4.1-4.8L9.3 5.1l.4 2.3 2.3.4Z"/>',
	apotek: '<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.4"/><path d="M8 5.4v5.2M5.4 8h5.2"/>'
};
const catGlyph = (key, size = 22) =>
	`<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${(1.3 * 13) / size + 0.35}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_GLYPH[key]}</svg>`;

const rampStrip = () =>
	`<div class="ramp" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<span style="background:var(--ramp-${i})"></span>`).join('')}</div>`;

const sectionMark = (n, label) =>
	`<div class="mark"><span class="tick"></span><span class="n">${n}</span><span class="l">${esc(label)}</span><span class="rule"></span></div>`;

const MODE_NAME = { mrt: 'MRT', krl: 'KRL', lrt: 'LRT', brt: 'TransJakarta' };

/* ── the maps ──────────────────────────────────────────────────────────── */

/**
 * Every cell where it actually is. `paint` picks what the colour reads: the trade
 * around each cell (what the map opens on), the score for the business type asked
 * about, or nothing, which draws the grid by its edges the way the idle map does.
 */
function hexMap(maps, { paint = 'none', routes = true, stops = true, marks = false, par = 'xMidYMid meet', routeWidth = 1.1 } = {}) {
	const cells = maps.cells
		.map((c) => {
			if (paint === 'none') return `<path class="cell" d="${c.d}"/>`;
			const v = paint === 'trade' ? c.trade : c.score;
			if (v === null) return `<path class="cell nodata" d="${c.d}"/>`;
			return `<path class="cell painted" d="${c.d}" style="fill:var(--ramp-${v})"/>`;
		})
		.join('');
	const lines = routes
		? ['brt', 'lrt', 'krl', 'mrt']
				.map(
					(m) =>
						`<path class="route" d="${maps.routes[m]}" style="stroke:var(--route-${m});stroke-width:${(routeWidth * (m === 'brt' ? 0.7 : 1.25)).toFixed(2)}"/>`
				)
				.join('')
		: '';
	const dots = stops
		? maps.stops.map((s) => `<circle class="stop" cx="${s.x}" cy="${s.y}" r="${s.mode === 'brt' ? 1.5 : 2.4}" style="fill:var(--route-${s.mode})"/>`).join('')
		: '';
	const rings = marks
		? maps.cells
				.filter((c) => c.marked)
				.map(
					(c) =>
						`<circle class="ring" cx="${c.centre.x}" cy="${c.centre.y}" r="17"/><text class="tag" x="${c.centre.x - 24}" y="${c.centre.y + 5}" text-anchor="end">${esc(c.name)}</text>`
				)
				.join('')
		: '';
	return `<svg class="map" viewBox="0 0 ${maps.width} ${maps.height}" preserveAspectRatio="${par}" aria-hidden="true">
<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--fill-1)"/><rect width="1.6" height="4" fill="var(--nodata)" fill-opacity="0.55"/></pattern></defs>
${lines}${cells}${dots}${rings}</svg>`;
}

/* ── the miniature ─────────────────────────────────────────────────────── */

/* The scene's own palette for the model, from `scene/area`: which grey each class of
   street is laid in and how high above the ground, which is the order they are drawn
   in, and how wide a transit corridor is laid over the street. */
const ROAD_COLOUR = {
	motorway: '#b2aea7',
	trunk: '#b2aea7',
	primary: '#b6b2ab',
	secondary: '#b6b2ab',
	tertiary: '#bbb7b0',
	minor: '#c0bcb5',
	service: '#c5c1ba',
	track: '#cbc7c0',
	path: '#cfcbc4',
	busway: '#aca8a1',
	rail: '#8f8d88',
	transit: '#8f8d88'
};
const ROAD_LEVEL = {
	path: 0.08,
	track: 0.09,
	service: 0.1,
	minor: 0.12,
	tertiary: 0.14,
	secondary: 0.16,
	primary: 0.18,
	busway: 0.19,
	trunk: 0.2,
	motorway: 0.22,
	rail: 0.24,
	transit: 0.24
};
const ROUTE_WIDTH = { mrt: 6, krl: 6, lrt: 5, brt: 5 };

/** Twice the signed area of a ring, positive counter-clockwise with x east and y north. */
function ringArea(ring) {
	let a = 0;
	for (let i = 0, n = ring.length; i < n; i++) {
		const p = ring[i];
		const q = ring[(i + 1) % n];
		a += p.x * q.y - q.x * p.y;
	}
	return a;
}

/**
 * The miniature: the basemap around the point, cut to the walking range and stood up
 * on a base, the way `scene/area` stands it up, drawn here in an oblique projection.
 *
 * Every building is the tile's footprint raised to the tile's height, the streets are
 * laid at the widths the area model and the modelled map share, and the marks stand
 * where the app stands them. The eye is above and to the south-west, so the walls
 * that show are the ones facing south and west, and the blocks are laid down far to
 * near. Buildings up to a few storeys are drawn as three shared paths, since at this
 * size no two of them overlap by more than a pixel, and the towers are drawn one by
 * one in order so that each stands in front of what is behind it.
 *
 * With no reading of the basemap the disc stands empty, and the caption beside it says
 * so in the app's own words: an empty disc must never pass for a finished one.
 */
function miniModel(mini, name, area, roadWidth) {
	const W = 880;
	const H = 660;
	const cx = 440;
	const cy = 342;
	const rx = 396;
	/* An orthographic view from above, the way a model on a table is looked at. The
	   disc is turned a little about its centre so that two faces of every block show,
	   and tilted so that its depth is foreshortened to `tilt` of its width. A height
	   then rises straight up the page by the cosine of that same elevation, which is
	   what keeps the verticals vertical: a shear would lean every tower like italic
	   type, and the app's own model leans nothing. */
	const turn = (28 * Math.PI) / 180;
	const tilt = 0.6;
	const lift = Math.sqrt(1 - tilt * tilt);
	const ry = rx * tilt;
	const s = rx / mini.radius;
	const rot = (p) => ({
		x: p.x * Math.cos(turn) + p.y * Math.sin(turn),
		y: -p.x * Math.sin(turn) + p.y * Math.cos(turn)
	});
	const P = (p, h = 0) => {
		const r = rot(p);
		return [cx + r.x * s, cy - r.y * s * tilt - h * s * lift];
	};
	const pt = (p, h = 0) => {
		const [x, y] = P(p, h);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	};
	const ring = (r, h = 0) => 'M' + r.map((p) => pt(p, h)).join('L') + 'Z';
	const line = (p) => 'M' + p.map((q) => pt(q)).join('L');

	let ground = '';
	let blocks = '';
	if (area) {
		for (const g of area.green) ground += `<path class="green" d="${g.rings.map((r) => ring(r)).join('')}"/>`;
		for (const w of area.water) ground += `<path class="water" d="${w.rings.map((r) => ring(r)).join('')}"/>`;
		for (const w of area.waterways) {
			ground += `<path class="stream" d="${line(w.path)}" style="stroke-width:${Math.max(0.8, w.width * s).toFixed(2)}"/>`;
		}
		const roads = [...area.roads].sort(
			(a, b) => ROAD_LEVEL[a.kind] - ROAD_LEVEL[b.kind] || Number(a.bridge) - Number(b.bridge)
		);
		for (const r of roads) {
			ground += `<path class="road" d="${line(r.path)}" style="stroke:${ROAD_COLOUR[r.kind]};stroke-width:${Math.max(0.7, roadWidth[r.kind] * s).toFixed(2)}"/>`;
		}
		for (const r of area.routes) {
			ground += `<path class="corridor" d="${line(r.path)}" style="stroke:var(--route-${r.mode});stroke-width:${Math.max(1.2, ROUTE_WIDTH[r.mode] * s).toFixed(2)}"/>`;
		}

		/* The eye is above and, in the turned frame, due south: the walls that show are
		   the ones facing down the page, and the blocks are laid down far to near, which
		   in that frame is north to south. Rings are turned first and kept
		   counter-clockwise, so each wall's outward side is known. */
		const eye = { x: 0, y: -lift / tilt };
		const oriented = (r) => (ringArea(r) < 0 ? [...r].reverse() : r);
		const items = area.buildings
			.map((b) => {
				const outer = oriented(b.rings[0].map(rot));
				let sy = 0;
				for (const p of outer) sy += p.y;
				return { ...b, outer, depth: (sy / (outer.length || 1)) * eye.y };
			})
			.sort((a, b) => a.depth - b.depth);
		let lowS = '';
		let lowW = '';
		let lowRoof = '';
		let tall = '';
		/* Turned points are projected without turning again. */
		const tp = (r, h = 0) => `${(cx + r.x * s).toFixed(1)},${(cy - r.y * s * tilt - h * s * lift).toFixed(1)}`;
		for (const b of items) {
			let south = '';
			let west = '';
			const r = b.outer;
			for (let i = 0; i < r.length; i++) {
				const p = r[i];
				const q = r[(i + 1) % r.length];
				const nx = q.y - p.y;
				const ny = -(q.x - p.x);
				if (nx * eye.x + ny * eye.y <= 0) continue;
				const face = `M${tp(p, b.base)}L${tp(q, b.base)}L${tp(q, b.height)}L${tp(p, b.height)}Z`;
				// The face turned toward the eye takes the lighter grey, one seen aslant the darker.
				if (Math.abs(ny) >= Math.abs(nx)) south += face;
				else west += face;
			}
			const roof = b.rings.map((rr) => ring(rr, b.height)).join('');
			if (b.height - b.base > 12) {
				tall += `<g>${west ? `<path class="wall w" d="${west}"/>` : ''}${south ? `<path class="wall s" d="${south}"/>` : ''}<path class="roof" d="${roof}"/></g>`;
			} else {
				lowS += south;
				lowW += west;
				lowRoof += roof;
			}
		}
		blocks = `<path class="wall w" d="${lowW}"/><path class="wall s" d="${lowS}"/><path class="roof" d="${lowRoof}"/>${tall}`;
	}

	const at = (d) => P(d).map((v) => v.toFixed(1));
	const doors = mini.doors
		.map((d) => {
			const [x, y] = at(d);
			return `<circle class="door${d.open ? ' lit' : ''}" cx="${x}" cy="${y}" r="${d.open ? 2.8 : 2.2}"/>`;
		})
		.join('');
	const rivals = mini.rivals
		.map((d) => {
			const [x, y] = P(d);
			return `<rect class="rival" x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" rx="1.2"/>`;
		})
		.join('');
	const units = mini.units
		.map((d) => {
			const [x, y] = P(d);
			return `<rect class="unit" x="${(x - 4.5).toFixed(1)}" y="${(y - 4.5).toFixed(1)}" width="9" height="9" rx="1" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
		})
		.join('');
	const recs = mini.field
		.map((d) => {
			const [x, y] = at(d);
			return `<circle class="rec" cx="${x}" cy="${y}" r="6"/>`;
		})
		.join('');
	const stops = mini.stops
		.map((d) => {
			const [x, y] = at(d);
			return `<circle class="stop" cx="${x}" cy="${y}" r="${d.mode === 'brt' ? 5 : 6.5}" style="fill:var(--route-${d.mode})"/>`;
		})
		.join('');

	return `<svg class="mini" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
<defs><filter id="soft" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="14"/></filter><clipPath id="disc"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath></defs>
<ellipse class="shade" cx="${cx}" cy="${cy + 50}" rx="${rx + 18}" ry="${ry + 10}" filter="url(#soft)"/>
<ellipse class="rim" cx="${cx}" cy="${cy + 20}" rx="${rx}" ry="${ry}"/>
<ellipse class="ground" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>
<g clip-path="url(#disc)">${ground}</g>
${blocks}
${doors}${rivals}${units}${recs}${stops}
<circle class="halo" cx="${cx}" cy="${cy}" r="18"/><circle class="beacon" cx="${cx}" cy="${cy}" r="6"/>
<text x="26" y="44" style="font-family:var(--font-display);font-size:26px;font-weight:600;letter-spacing:-0.02em" fill="var(--label-1)">${esc(name)}</text>
</svg>`;
}

/** Cells by how many businesses stand in walking range, as the landing page draws it. */
function spreadChart(spread, copy) {
	const W = 1000;
	const H = 250;
	const top = Math.max(1, ...spread.map((b) => b.cells));
	const gap = 10;
	const bw = (W - gap * (spread.length - 1)) / spread.length;
	const bars = spread
		.map((b, i) => {
			const h = Math.max(2, ((H - 70) * b.cells) / top);
			const x = i * (bw + gap);
			const y = H - 40 - h;
			return `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/>
<text class="val" x="${(x + bw / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle">${b.cells}</text>
<text class="axis" x="${(x + bw / 2).toFixed(1)}" y="${H - 16}" text-anchor="middle">${num(b.upTo)}</text>`;
		})
		.join('');
	return `<svg class="spread" viewBox="0 0 ${W} ${H}" aria-hidden="true"><line class="base" x1="0" x2="${W}" y1="${H - 40}" y2="${H - 40}"/>${bars}</svg>`;
}

/** Doors open per hour on one day, for the card. */
function hourCurve(hours) {
	const W = 600;
	const H = 92;
	const top = Math.max(1, ...hours.curve);
	const bw = W / 24;
	const peakHour = hours.curve.indexOf(top);
	const bars = hours.curve
		.map((v, h) => {
			const bh = Math.max(1.5, ((H - 26) * v) / top);
			return `<rect class="bar${h === peakHour ? ' peak' : ''}" x="${(h * bw + 2).toFixed(1)}" y="${(H - 22 - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" rx="2"/>`;
		})
		.join('');
	const axis = [0, 6, 12, 18]
		.map((h) => `<text class="axis" x="${(h * bw + 2).toFixed(1)}" y="${H - 6}">${esc(hours.hourLabel(h))}</text>`)
		.join('');
	return `<svg class="curve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}${axis}</svg>`;
}

/** The score taken apart, step by step, on the 0 to 100 scale the card prints. */
function waterfall(comp) {
	const rows = comp.steps
		.map((s) => {
			const before = s.after - s.delta;
			const lo = Math.min(before, s.after);
			const hi = Math.max(before, s.after);
			const dir = s.key === 'start' ? 'start' : s.delta > 0 ? 'up' : s.delta < 0 ? 'down' : 'same';
			const delta =
				s.key === 'start'
					? String(s.after)
					: s.factor !== null && s.delta === 0
						? `×${s.factor.toFixed(2)}`
						: `${s.delta > 0 ? '+' : ''}${s.delta}`;
			const factor = s.factor !== null && s.delta !== 0 ? ` <span class="note">×${s.factor.toFixed(2)}</span>` : '';
			return `<div class="step">
<div class="k">${esc(s.label)}<span class="note">${esc(s.note)}</span></div>
<div class="track"><span class="keep" style="width:${lo}%"></span><span class="move ${dir}" style="left:${lo}%;width:${Math.max(0.4, hi - lo)}%"></span></div>
<div class="d ${dir}">${delta}${factor}</div>
</div>`;
		})
		.join('');
	return `<div class="wf">${rows}
<div class="step total"><div class="k">${esc(comp.total)}</div><div class="track"><span class="keep sum" style="width:${comp.score}%"></span></div><div class="d">${comp.score}</div></div>
</div>`;
}

/* ── the interface, drawn in its own materials ─────────────────────────── */

function chrome(f) {
	return `<span class="brand material">${brandMark(15)}<span>SpotOn</span></span>
<span class="tools material"><span class="acc">${tapak(14)}<b>${f.plans[0].week.ai}</b><span class="sep"></span><b>${f.plans[0].week.analysis}</b></span><span class="sep"></span><span class="tog"><span>ID</span><span class="on">EN</span></span><span class="sep"></span><span class="tog"><span class="on">Auto</span></span></span>`;
}

function launcher(f) {
	const L = f.launch;
	const first = L.suggestions[0].ask;
	return `<div class="launcher">
<div class="face">${tapak(44)}</div>
<p class="salute">${esc(L.salute)}</p>
<h2>${esc(L.title)}</h2>
<div class="form"><span class="ph">${esc(first.slice(0, 42))}<span class="caret"></span></span><span class="go">${glyph('arrow', 18)}</span></div>
<ul class="picks">${L.suggestions.map((s) => `<li>${esc(s.short)}</li>`).join('')}</ul>
<div class="lstats">
<div><span class="v">${num(f.grid.hexes)}</span><span class="k">${esc(L.stats.hexes)}</span></div>
<div><span class="v">${num(f.grid.stops)}</span><span class="k">${esc(L.stats.stops)}</span></div>
<div><span class="v">${num(Math.max(f.grid.mapidPoints, f.grid.pois))}</span><span class="k">${esc(L.stats.pois)}</span></div>
<div><span class="v">${f.categories.length}</span><span class="k">${esc(L.stats.cats)}</span></div>
</div>
<p class="skip">${esc(L.skip)}</p>
</div>`;
}

function tapakPanel(f) {
	const d = f.demo;
	const t = f.tapakCopy;
	return `<div class="tp">
<div class="row">${tapak(24)}<div class="bubble">${esc(f.greeting)}</div></div>
<div class="row mine"><div class="bubble said">${esc(d.question)}</div></div>
<div class="caught"><p class="eyebrow">${esc(t.caught)}</p><ul class="chips">${d.chips.map((c) => `<li class="chip">${esc(c)}</li>`).join('')}</ul></div>
<div class="row">${tapak(24, true)}<div class="bubble">${esc(d.sentence)}
<ol class="places">${d.results.map((r, i) => `<li class="place${i === 0 ? ' on' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(r.name)}</span><span class="sc">${r.pct}</span></li>`).join('')}</ol>
${d.more ? `<p class="more">+${d.more} more</p>` : ''}</div></div>
<ul class="chips follow"><li class="chip">${esc(t.budgetLoose)}</li><li class="chip">${esc(t.why)}</li><li class="chip">${esc(t.avoid)}</li></ul>
<div class="ask"><span class="field">${esc(t.ask)}</span><span class="go">${glyph('arrow', 18)}</span></div>
</div>`;
}

function mapKey(f) {
	return `<div class="mkey"><p class="eyebrow">${esc(f.copy.ai.mapCaption(f.demo.choice.toLowerCase()).split(',')[0])}</p>${rampStrip()}<div class="ends"><span>${esc(f.copy.scale.low)}</span><span>${esc(f.copy.scale.high)}</span></div><p class="nd"><span class="key"></span>${esc(f.copy.scale.nodata)}</p></div>`;
}

function areaCard(f) {
	const e = f.example;
	const c = f.copy;
	const hours = e.hours.thin
		? `<p class="line">${esc(e.hours.thinNote)}</p>`
		: `${hourCurve(e.hours)}<p class="line">${esc(e.hours.day)}. ${esc(e.hours.peak)}</p>`;
	return `<div class="card">
<div class="chead"><span class="pivot">${glyph('cell', 18)}</span><div class="who"><h2>${esc(e.name)}</h2><p class="sub"><span class="dot" style="background:var(--ramp-${e.rampIndex})"></span>${esc(e.typology)}</p><p class="standing">${esc(e.standing)}</p></div><span class="score">${e.score}</span></div>
<span class="askbtn">${tapak(14)}${esc(f.tapakCopy.askAbout)}</span>
<div class="sec"><div class="sh"><span class="ico">${glyph('score', 16)}</span><span class="eyebrow">${esc(c.breakdown.title)}</span><span class="aside">${esc(f.demo.choice)}</span></div>
<div class="rows">${e.rows.map((r) => `<div class="r"><span class="k">${esc(r.label)}${r.sub ? `<span class="st">${esc(r.sub)}</span>` : ''}</span><span class="v">${esc(r.value)}</span></div>`).join('')}</div></div>
<div class="sec"><div class="sh"><span class="ico">${glyph('transit', 16)}</span><span class="eyebrow">${esc(c.mood.transit)}</span></div>
<div class="big"><span class="v">${e.transit.total}</span><span class="k">${esc(e.transit.count)}</span></div><p class="line">${esc(e.transit.split)}. ${esc(e.transit.band)}</p></div>
<div class="sec"><div class="sh"><span class="ico">${glyph('price', 16)}</span><span class="eyebrow">${esc(c.property.title)}</span></div>
<div class="big"><span class="v">${e.cost.price === null ? '·' : esc(rp(e.cost.price))}</span><span class="k">${esc(e.cost.cap)}</span></div><p class="line">${e.cost.rank ? esc(e.cost.rank) + ' ' : ''}${esc(e.cost.effect)}</p></div>
<div class="sec"><div class="sh"><span class="ico">${glyph('hours', 16)}</span><span class="eyebrow">${esc(c.activity.title)}</span><span class="aside">${esc(e.hours.denominator)}</span></div>${hours}</div>
<div class="sec"><div class="sh"><span class="ico">${glyph('field', 16)}</span><span class="eyebrow">${esc(c.field.title)}</span></div><p class="line">${esc(e.field.count)}. ${esc(c.field.notCensus)}</p></div>
</div>`;
}

/* ── the slides ─────────────────────────────────────────────────────────── */

function slide(cls, inner, opts = {}) {
	const foot = opts.foot === false ? '' : `<div class="foot"><span class="brandchip quiet">${brandMark(13)}<span>SpotOn</span></span><span class="num">${opts.num}</span></div>`;
	const style = opts.frameStyle ? ` style="${opts.frameStyle}"` : '';
	return `<section class="slide ${cls}">${opts.raw ?? ''}<div class="frame"${style}>${inner}</div>${foot}</section>`;
}

export function renderDeck(f, assets) {
	const g = f.grid;
	const e = f.engine;
	const cp = f.copy;
	const pages = [];

	/* 1 · cover */
	pages.push((pg) =>
		slide(
			'dark cover',
			`<div>${brandChip()}</div>
<div class="title"><h1 class="big">${esc(cp.stage.heroTitle).replace('\n', '<br>')}</h1><p class="sub">${esc(cp.footer.desc)}</p></div>
<div class="meta"><div><b>MAPID WebGIS Competition 2026</b><br>Maps That Think! Mass Transportation Edition</div><div style="text-align:right"><b>${esc(cp.footer.teamLabel)}</b><br>${esc(cp.footer.team)}<br>${esc(cp.footer.campus)}</div></div>`,
			{
				num: pg,
				foot: false,
				raw: `<div class="bgmap">${hexMap(f.maps, { paint: 'trade', routeWidth: 1.4 })}</div><div class="veil"></div><div class="veil2"></div>`
			}
		)
	);

	/* 2 · the problem */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('01', cp.problem.mark)}
<div class="head"><h1>${esc(cp.problem.title)}</h1><p class="lead">${esc(cp.problem.statement)}</p></div>
<ul class="tri">${cp.problem.rows.map((r) => `<li><h3>${esc(r.t)}</h3><p>${esc(r.d)}</p></li>`).join('')}</ul>
<figure class="panel" style="padding:32px 40px 28px;margin-top:auto;display:grid;grid-template-columns:440px 1fr;gap:48px;align-items:center">
<figcaption><h3>${esc(cp.problem.chartTitle)}</h3><p class="body" style="margin-top:10px;font-size:19px">${esc(cp.problem.chartBody)}</p><p class="small" style="margin-top:14px">${esc(cp.spread.caption)} Each column is a band, up to that many businesses, and the figure above it is how many cells fall in the band.</p></figcaption>
<div style="height:300px">${spreadChart(f.spread, cp.spread)}</div>
</figure>`,
			{ num: pg }
		)
	);

	/* 3 · the idea */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('02', cp.how.mark)}
<div class="head solo"><h1>${esc(cp.how.plain)}</h1></div>
<ul class="quad" style="margin-top:14px">
<li><span class="ico">${glyph('market', 24)}</span><h3>Demand</h3><p>The trade already standing around the cell, other than your kind. If a block supports dozens of businesses, people plainly come past.</p></li>
<li><span class="ico">${glyph('rivals', 24)}</span><h3>Competition</h3><p>Rivals of your kind within walking range, counted from two surveys. The fuller one speaks for a cell, and the two are never added.</p></li>
<li><span class="ico">${glyph('sign', 24)}</span><h3>Space</h3><p>Premises actually on the market. A requirement rather than a bonus: a good area with nothing to take is not an opportunity.</p></li>
<li><span class="ico accent">${glyph('transit', 24)}</span><h3>Transit access</h3><p>The multiplier, and what decides it most. How many stops a cell reaches within ${g.walkRadius} m, with rail worth more than a bus.</p></li>
</ul>
<div class="band" style="margin-top:auto"><h3>${esc(cp.how.title)}</h3><p>${esc(cp.how.steps[3].d)} A ranking comes back with its reasons attached, and a place can be taken apart term by term.</p>
<ul class="chips" style="margin-left:auto;flex:none">${['underserved', 'competitive', 'saturated', 'busy-limited-space'].map((k) => `<li class="chip soft">${esc(cp.typology[k])}</li>`).join('')}</ul></div>`,
			{ num: pg }
		)
	);

	/* 4 · the evidence */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('03', cp.data.mark)}
<div class="head"><h1>${esc(cp.data.title)}</h1><p class="lead">${esc(cp.data.body)}</p></div>
<ul class="stats" style="margin-top:20px">
<li class="stat"><span class="v">${num(g.hexes)}</span><span class="l">${esc(cp.stats.hexes.label)}</span><span class="s">${esc(cp.stats.hexes.sub(g.walkRadius))}</span></li>
<li class="stat"><span class="v">${num(g.stops)}</span><span class="l">${esc(cp.stats.stops.label)}</span><span class="s">${esc(cp.stats.stops.sub)}</span></li>
<li class="stat"><span class="v">${num(g.mapidPoints)}</span><span class="l">${esc(cp.stats.pois.label)}</span><span class="s">MAPID catalogue, ${f.categories.length} business types, five DKI cities</span></li>
<li class="stat"><span class="v">${f.categories.length}</span><span class="l">${esc(cp.stats.cats.label)}</span><span class="s">${esc(cp.stats.cats.sub)}</span></li>
</ul>
<ul class="stats minor" style="margin-top:auto">
<li class="stat"><span class="v">${num(g.pois)}</span><span class="l">competitor points from OpenStreetMap</span><span class="s">${g.osmCategories} business types, all of Jakarta</span></li>
<li class="stat"><span class="v">${num(g.listings)}</span><span class="l">premises on the market</span><span class="s">asking prices for sale, ${num(g.cellsPriced)} cells with a median</span></li>
<li class="stat"><span class="v">${num(f.missions.placed)}</span><span class="l">field notes that landed in a cell</span><span class="s">Struk Go, Menu Go, Properti Go and community notes, ${num(f.missions.cells)} cells</span></li>
<li class="stat"><span class="v">${num(f.hours.readable)}</span><span class="l">readable opening timetables</span><span class="s">of ${num(f.hours.businesses)} businesses counted, ${num(f.hours.published)} publishing hours</span></li>
</ul>`,
			{ num: pg }
		)
	);

	/* 5 · the grid */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('04', 'The grid')}
<div style="display:grid;grid-template-columns:600px 1fr;gap:64px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:28px">
<h1 style="font-size:64px">${esc(cp.how.steps[0].t)}, one hexagon per cell.</h1>
<p class="body">Jakarta is covered with an H3 grid at resolution ${g.resolution}, about ${num(g.edgeM)} m to a side. Only the <strong>${num(g.hexes)} cells</strong> with a transit stop within ${g.walkRadius} m are scored, and the score reads everything within that walk of the cell centre.</p>
<p class="body">Not one catchment per stop, on purpose. TransJakarta stops sit a few hundred metres apart while the walking range is ${g.walkRadius} m, so per-stop catchments overlap and count the same shoppers over and over. On a grid each cell is counted once, and transit access becomes a property of the cell: a place served by both the MRT and TransJakarta really is worth more.</p>
<div class="legend hair" style="padding-top:22px">${['mrt', 'krl', 'lrt', 'brt'].map((m) => `<div class="row"><span class="dot" style="background:var(--route-${m})"></span>${MODE_NAME[m]}<span class="n">${num(g.stopsByMode[m])}</span></div>`).join('')}<div class="row" style="color:var(--label-3);font-size:16px">${num(g.stops)} transit nodes and the corridor geometry, from OpenStreetMap</div></div>
</div>
<figure class="panel" style="padding:22px;height:846px;display:flex;flex-direction:column;gap:12px"><div style="flex:1;min-height:0">${hexMap(f.maps, { paint: 'none' })}</div><figcaption class="small" style="text-align:center">Every hexagon at its real place. Corridors and stops in their mode's colour, the grid drawn by its edges as it is before a question is asked.</figcaption></figure>
</div>`,
			{ num: pg }
		)
	);

	/* 6 · three kinds of data */
	const m = f.missions;
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('05', 'Sources')}
<div class="head"><h1>Three kinds of data, kept apart.</h1><p class="lead">Two of them claim completeness for the city they cover, so a zero from them is a finding. The third is streets somebody walked, and an empty cell there only means nobody has been.</p></div>
<ul class="tri" style="margin-top:8px">
<li><p class="eyebrow">OpenStreetMap · ODbL</p><h3 style="margin-top:10px">Transit, competitors, hours</h3><p>${num(g.stops)} transit nodes in four modes and the corridor geometry. ${num(g.pois)} competitor points in ${g.osmCategories} business types. ${num(f.hours.readable)} readable opening timetables, read as doors open per hour.</p></li>
<li><p class="eyebrow">MAPID premium catalogue</p><h3 style="margin-top:10px">Businesses and premises</h3><p>${num(g.mapidPoints)} business points in all ${f.categories.length} types across the five DKI cities, every one carrying its name. ${num(g.listings)} premises on the market, as asking prices to buy. Coverage is decided per administrative city.</p></li>
<li><p class="eyebrow">MAPID APPS field missions</p><h3 style="margin-top:10px">Struk Go, Menu Go, Properti Go</h3><p>${num(m.records)} records read, ${num(m.placed)} landed in ${num(m.cells)} catchments: ${num(m.byMission.struk)} receipts, ${num(m.byMission.menu)} eateries, ${num(m.byMission.properti)} premises and ${num(m.byMission.catatan)} community notes. Evidence beside the score, never a term in it.</p></li>
</ul>
<div class="panel" style="margin-top:auto;padding:24px 36px;display:grid;grid-template-columns:1fr 400px;gap:40px;align-items:center">
<div><h3>${esc(cp.data.gridLabel(g.hexes, g.surveyed, g.unsurveyed).replace(/\.$/, ''))}.</h3><p class="body" style="margin-top:10px;font-size:20px">A cell whose city the catalogue has never read is drawn hatched and left unscored. It is never interpolated, never rounded to zero, and never quietly dropped from a ranking. The five cities: ${g.dki.map((d) => `${esc(d.name)} ${num(d.n)}`).join(', ')}.</p>
<div class="legend" style="flex-direction:row;gap:28px;margin-top:14px"><div class="row" style="font-size:16px"><span class="dot" style="background:var(--ramp-3)"></span>${esc(cp.data.gridWithData)}<span class="n">${num(g.surveyed)}</span></div><div class="row" style="font-size:16px"><span class="hatchkey"></span>${esc(cp.data.gridEmpty)}<span class="n">${num(g.unsurveyed)}</span></div></div></div>
<div style="height:250px">${hexMap(f.maps, { paint: 'trade', routes: false, stops: false })}</div>
</div>`,
			{ num: pg }
		)
	);

	/* 7 · how the score is made */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('06', 'The score')}
<div style="display:grid;grid-template-columns:760px 1fr;gap:64px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:26px">
<h1 style="font-size:60px">${esc(cp.breakdown.title)}</h1>
<div class="formula">Gap <span class="op">=</span> (<span class="v">w<sub>d</sub></span>·demand <span class="op">−</span> <span class="v">w<sub>s</sub></span>·supply) <span class="op">/</span> (<span class="v">w<sub>d</sub></span> <span class="op">+</span> <span class="v">w<sub>s</sub></span>)<br>Score <span class="op">=</span> clamp(Gap <span class="op">+</span> ${e.balance}) <span class="op">×</span> gate <span class="op">×</span> access <span class="op">×</span> cost</div>
<ul class="terms">
<li><b>Demand</b><span>the trade around the cell other than your kind, as a share of the busiest cell on the grid</span></li>
<li><b>Competition</b><span>rivals of your kind, as a share of the densest street for them. Weighted ${e.wd} and ${e.ws} by default, and the reader can move both</span></li>
<li><b>Space gate</b><span>×1 where premises are on the market, ×${e.gateBlocked} where none are. Pushed to the bottom of the ranking, not struck off it</span></li>
<li><b>Transit access</b><span>×${e.accessFloor} with no stop in range, up to ×${(e.accessFloor + e.accessSpan).toFixed(1)}. MRT ${e.modeWeight.mrt}, KRL ${e.modeWeight.krl}, LRT ${e.modeWeight.lrt}, TransJakarta ${e.modeWeight.brt} per stop</span></li>
<li><b>Cost of space</b><span>×1 down to ×${e.costFloor}, a rank among the catchments that carry a price. Never above 1, so an unpriced place is never handed a price to be judged on</span></li>
</ul>
<p class="small">${esc(cp.breakdown.lead)} Every term is counted, none is generated.</p>
</div>
<figure class="panel" style="padding:28px 32px 20px;display:flex;flex-direction:column;gap:14px"><div><p class="eyebrow">${esc(f.example.name)} · ${esc(f.demo.choice.toLowerCase())} · ${g.walkRadius} m</p><h3 style="margin-top:6px">${esc(cp.breakdown.transitLead)}</h3></div>${waterfall(f.example.composition)}<p class="small" style="margin-top:4px">${esc(f.example.composition.contributes)} ${esc(cp.breakdown.lead)}</p></figure>
</div>`,
			{ num: pg }
		)
	);

	/* 8 · ask the map */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('07', cp.ai.mark)}
<div class="head"><h1>The answer is computed, and then it is said.</h1><p class="lead">${esc(cp.ai.p1)}</p></div>
<div class="pipe" style="margin-top:10px">
<div class="box"><p class="eyebrow">The question</p><h3>Asked in plain language</h3><p>Indonesian or English, typed or tapped. The turns before it travel with it, so a follow-up that only points, why that one, is read in context.</p></div>
<div class="box"><p class="eyebrow">Understanding</p><h3>The model picks an operation</h3><p>Through function calling it names a shape, a measure and the arguments, never a value. A question outside the data comes back as not understood. Without a key, or after ${f.llm.totalS} seconds, the rule parser takes over.</p></div>
<div class="box engine"><p class="eyebrow">Computing</p><h3>The scoring engine on the grid</h3><p>Every figure a reader sees, score, demand, rivals, price, standing, is computed on the data in one go. No figure is ever streamed a digit at a time.</p></div>
<div class="box"><p class="eyebrow">Writing</p><h3>The model writes the sentence</h3><p>From a fact sheet of the figures this turn produced. A reply carrying a figure or a place not on the sheet is thrown away whole, and the composed sentence stands in.</p></div>
<div class="box"><p class="eyebrow">The screen</p><h3>The map repaints</h3><p>The answer names places, the whole city recolours for the business type, and every reply says which path read it, the model or the rules.</p></div>
</div>
<div class="band"><h3>No figure a reader sees came from the model.</h3><p>The model decides what to look up and how to say it. The arithmetic is the engine's alone, and the fence checks every sentence against the figures it was handed. Five shapes of question, rank, flag the saturated, compare, coverage and explain, across ${f.measures} measures, chosen separately.</p></div>
<div style="margin-top:auto"><p class="eyebrow" style="margin-bottom:12px">What streams while the reader waits: the stage, never a figure</p><div class="stages">${['reading', 'retrying', 'choosing', 'computing', 'writing'].map((k) => `<span class="st"><span class="k">${k}</span><span>${esc(f.stages[k])}</span></span>`).join('')}</div><p class="small" style="margin-top:12px">Reported from where the work actually is, never on a timer and never as a percentage. Up to ${f.llm.totalS} seconds for understanding across a chain of ${f.llm.chain} free models, ${f.llm.writeS} for the written reply.</p></div>`,
			{ num: pg, frameStyle: 'gap:26px' }
		)
	);

	/* 9 · Tapak */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('08', 'Tapak')}
<div style="display:grid;grid-template-columns:1fr 700px;gap:72px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:30px">
<span class="plinth" style="width:120px;height:120px">${tapak(68, true)}</span>
<h1 style="font-size:66px">${esc(cp.ai.meet.title)}</h1>
<p class="body" style="max-width:52ch">${esc(cp.ai.meet.body)}</p>
<ul class="notes" style="gap:18px;margin-top:6px">
<li class="accent"><h3>The waiting state is the figure.</h3><p>A spinner says the machine is busy. Tapak pacing says somebody is looking it up, and it is the same figure that answers.</p></li>
<li><h3>Small talk is allowed, and fenced.</h3><p>Hello, what SpotOn is, and general business talk. Any digit in such a reply and it is thrown away, because nothing was computed behind it.</p></li>
<li><h3>The map never moves on a casual turn.</h3><p>No items, no highlight, no change of business type. Only an answer computed from the data can repaint the city.</p></li>
</ul>
</div>
<div class="panel" style="padding:26px;display:flex;flex-direction:column;gap:16px;background:var(--mat-thick)">
<div class="tp" style="position:static;width:auto;padding:0;background:none;box-shadow:none">
<div class="row">${tapak(24)}<div class="bubble">${esc(f.greeting)}</div></div>
<ul class="chips" style="padding-left:44px;gap:8px">${f.categories.map((c) => `<li class="chip" style="font-size:14.5px;padding:6px 13px;gap:8px">${catGlyph(c.key, 15)}${esc(c.name)}</li>`).join('')}</ul>
<div class="row mine"><div class="bubble said">${esc(f.demo.choice)}</div></div>
<div class="row">${tapak(24, true)}<div class="bubble" style="color:var(--label-3)">${esc(f.stages.computing)} <span style="letter-spacing:2px">···</span></div></div>
</div>
<p class="small" style="border-top:1px solid var(--separator);padding-top:14px">The greeting follows the clock on the reader's own device and knows nothing else: not the weather, not whether the street is busy. Both surfaces that say hello read one table, so they cannot disagree about the hour.</p>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 10 · the interface, act one */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('09', 'The interface')}
<div style="display:grid;grid-template-columns:1210px 1fr;gap:56px;flex:1;min-height:0;align-items:start">
<div class="app" style="height:846px">${hexMap(f.maps, { paint: 'trade', par: 'xMidYMid slice', routeWidth: 1.4 })}<div class="scrim"></div>${chrome(f)}${launcher(f)}</div>
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Act one. One question, where the eye already is.</h2>
<ul class="notes">
<li class="accent"><h3>Nothing to fill in.</h3><p>No rail of thirteen buttons, no sliders, no table. A greeting by the hour, the one question the reader is here to answer, and a field that takes anything.</p></li>
<li><h3>The examples teach the shape.</h3><p>They type themselves into the field and clear again, and the same four sit under it as buttons, so nobody has to type to get started.</p></li>
<li><h3>The evidence is on the card.</h3><p>Four counts at the foot, read from the grid file's own metadata. Rebuild the grid and they follow.</p></li>
<li><h3>The map is free.</h3><p>Panning, colouring, switching business type, moving the range: none of it is metered. Behind the box the city is already painted by the trade around each cell.</p></li>
</ul>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 11 · act two */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('10', 'The interface')}
<div style="display:grid;grid-template-columns:1210px 1fr;gap:56px;flex:1;min-height:0;align-items:start">
<div class="app" style="height:846px">${hexMap(f.maps, { paint: 'score', par: 'xMidYMid slice', marks: true, routeWidth: 1.4 })}${chrome(f)}<div class="mcat"><span class="chip on">${catGlyph(f.categories[0].key, 15)}${esc(f.demo.choice)}</span></div>${mapKey(f)}<div class="mctl"><span class="seg"><span class="on">Flat</span><span>3D</span></span><span class="seg"><span class="on">Drawn</span><span>Modelled</span></span></div>${tapakPanel(f)}</div>
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Act two. Ask, and the whole city recolours.</h2>
<ul class="notes">
<li class="accent"><h3>The box flies right and becomes the thread.</h3><p>The map takes over. Every place the answer names is marked on it, and tapping one opens its card.</p></li>
<li><h3>What the map understood comes first.</h3><p>${esc(cp.ai.p2)}</p></li>
<li><h3>Every figure in the list is the engine's.</h3><p>${esc(f.demo.results[0].name)} leads at ${f.demo.results[0].pct} out of 100, computed on the grid just now, with ${esc(f.demo.chips[3])} as the only narrowing.</p></li>
<li><h3>The follow-ups are real follow-ups.</h3><p>Why that one, any rent, which ones to avoid. Each is read against the thread, and the reply says which path read it.</p></li>
</ul>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 12 · the area card */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('11', 'One area')}
<div style="display:grid;grid-template-columns:660px 1fr;gap:72px;flex:1;min-height:0;align-items:start">
${areaCard(f)}
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Tap a cell, and it is taken apart.</h2>
<ul class="notes">
<li class="accent"><h3>An index says where it sits.</h3><p>${esc(cp.mood.standingNote)} A count is its own comparator, so the counts say nothing extra.</p></li>
<li><h3>The price is a price to buy.</h3><p>${esc(cp.property.saleNote)}</p></li>
<li><h3>The curve counts doors, not people.</h3><p>For each hour, how many businesses within walking range publish a timetable that says they are open. The denominator travels with it, because fewer than one business in six publishes hours at all.</p></li>
<li><h3>Field notes are recorded, not counted.</h3><p>Receipts, what a meal costs, how busy the place looked, space being offered. Photographed, so the street can be seen first, and kept out of the score.</p></li>
</ul>
<p class="small">Figures for ${esc(f.example.name)}, ${esc(f.demo.choice.toLowerCase())}, ${g.walkRadius} m walking range, computed by the engine on the grid at build time.</p>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 13 · the place as a model */
	const model = f.model;
	const marks = model.marks;
	const area = model.area;
	const states = model.states;
	const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
	const areaLine = area
		? `${cap(states.ready)}: ${num(area.buildings.length)} buildings and ${num(area.roads.length)} street pieces within ${g.walkRadius} m of ${esc(area.name)}, each building at the height the tile carries and one the tile gives no height at ${model.defaultHeight} m. Read from ${esc(area.source)} on ${esc(area.read)}, cut to the disc by the app's own reader.`
		: `${cap(states.failed)} when this copy was built, so the disc stands empty rather than showing a place that was not read. Rebuilt where the tiles can be fetched, the same slide draws the place.`;
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('12', cp.model.mark)}
<div style="display:grid;grid-template-columns:1fr 880px;gap:56px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:26px">
<h1 style="font-size:64px">${esc(cp.model.title)}</h1>
<p class="lead">${esc(cp.model.lead)}</p>
<ul class="notes" style="gap:18px">
<li class="accent"><h3>${esc(model.name)}, as on the front page.</h3><p>The business district, chosen by name rather than by score. A height read off a tile is only visible where there are heights, and the towers are what a reader can see the model doing.</p></li>
<li><h3>Read, not composed.</h3><p>The basemap's own vector tiles, cut to a disc of the walking range around the point the range is measured from. A street the tile does not draw is not drawn.</p></li>
<li><h3>Doors light by the hour.</h3><p>One mark per business with readable hours, lit when its timetable says it is open in the hour on the slider. Where the doors were not counted, none is drawn and the view says so.</p></li>
<li><h3>A miniature, not a view.</h3><p>A disc on a base with a rim, turned by hand, with the sun staying where it is in the world. The map itself can be looked at the same way, drawn or modelled.</p></li>
</ul>
</div>
<figure class="panel" style="padding:16px 26px 22px;display:flex;flex-direction:column;gap:10px">
<div style="display:flex;justify-content:center">${miniModel(marks, model.name, area, model.roadWidth)}</div>
<div class="keyrow"><span><i class="be"></i>the point the range is measured from</span><span><i class="st"></i>transit nodes, ${marks.stops.length}</span><span><i class="sq"></i>${esc(f.demo.choice.toLowerCase())} rivals, ${marks.rivals.length}</span><span><i class="di"></i>units on the market, ${marks.units.length}</span><span><i class="ri"></i>field records, ${marks.field.length}</span><span><i class="lit"></i>doors open at ${esc(marks.hour)} on a ${esc(marks.day)}, ${marks.doors.filter((d) => d.open).length} of ${marks.doors.length}</span></div>
<figcaption class="small">${areaLine}</figcaption>
</figure>
</div>`,
			{ num: pg }
		)
	);

	/* 14 · what it refuses to do */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('13', 'Honesty')}
<div class="head"><h1>What it refuses to do.</h1><p class="lead">The product's whole claim is that its figures do not come from anybody's memory. These are the rules that keep it true, and each of them cost something to learn.</p></div>
<ol class="rules" style="margin-top:8px">
<li><span class="n">1</span><span><strong>Read a null as a zero.</strong> An unsurveyed city is not an empty one. It is dropped from a ranking rather than sorted to the bottom, where it would crown the least examined streets the best opportunities.</span></li>
<li><span class="n">2</span><span><strong>Invent a threshold.</strong> A filter names a band, the cheapest third or the busiest, cut from the grid's own distribution at query time. There is no way to say under thirty million, because that figure would come from nobody's data.</span></li>
<li><span class="n">3</span><span><strong>Type a figure into copy.</strong> Every count on every page, this deck included, is read from the grid's metadata or computed from it. A number written by hand once went stale in silence.</span></li>
<li><span class="n">4</span><span><strong>Call a sale price a rent.</strong> The catalogue publishes no rent for Jakarta, re-checked on every fetch. So the cost of space is an asking price to buy, named as such wherever it travels, and it only ever deducts.</span></li>
<li><span class="n">5</span><span><strong>Count people.</strong> Nobody has counted a person for this product. The activity chart counts doors open per hour from published timetables, and refuses a timetable it can only half read.</span></li>
<li><span class="n">6</span><span><strong>Let a survey into the score.</strong> Field notes ride beside the figures as evidence. Folded into the arithmetic, nobody went here would be identical to nothing happens here.</span></li>
<li><span class="n">7</span><span><strong>Let the model write a number.</strong> A written reply may carry only figures and places it was handed, and one that does not is thrown away whole. A rejection is logged with its reason, never silent.</span></li>
<li><span class="n">8</span><span><strong>Guess.</strong> A question the data cannot answer comes back as not understood, and a sentence the rule parser reads nothing in is answered by saying what can be asked, never by the default ranking.</span></li>
</ol>`,
			{ num: pg }
		)
	);

	/* 15 · the demo */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('14', 'The demo')}
<div class="head"><h1>Six minutes, from the front page to a shortlist.</h1><p class="lead">What to click, and the one sentence to say at each step. Every figure that appears on screen is the engine's, so nothing has to be rehearsed except the order.</p></div>
<ol class="script" style="margin-top:6px">
<li><span class="n">1</span><div><h3>Open the front page and scroll one block.</h3><p>The street model walks through a day as the page scrolls. <span class="say">Say:</span> busy is something you can count. The four figures above are read from the grid file, not typed.</p></div></li>
<li><span class="n">2</span><div><h3>Let the conversation play.</h3><p>The map beside it recolours for each business type. <span class="say">Say:</span> the questions are samples, the answers are computed by the same engine the app runs.</p></div></li>
<li><span class="n">3</span><div><h3>Sign in and open the app.</h3><p>One button in demo mode, no password. Tapak greets by the hour. <span class="say">Say:</span> ${esc(f.launch.title.toLowerCase())}</p></div></li>
<li><span class="n">4</span><div><h3>Tap “${esc(f.demo.choice)}”, then “${esc(f.tapakCopy.budgetTight)}”.</h3><p>The city recolours, the top three arrive, the chips show what was understood. <span class="say">Say:</span> the filter is a band from the grid's own thirds, never a number the model chose.</p></div></li>
<li><span class="n">5</span><div><h3>Ask “${esc(f.tapakCopy.why)}”</h3><p>Typed or tapped. The score comes back taken apart, transit first. <span class="say">Say:</span> the model wrote this sentence, the engine wrote every figure in it.</p></div></li>
<li><span class="n">6</span><div><h3>Tap the top cell and walk the card.</h3><p>Standing against the grid, the nodes it reaches, what space costs, when the doors are open, what somebody recorded there. <span class="say">Say:</span> each index says where it sits among every area that has one.</p></div></li>
<li><span class="n">7</span><div><h3>Open the model, turn it, drag the hour.</h3><p>Then switch the map to 3D and to Modelled. <span class="say">Say:</span> a building stands at the height the map records. Nothing on this disc was composed.</p></div></li>
<li><span class="n">8</span><div><h3>Switch language mid-answer, then open the account page.</h3><p>Indonesian and English are one dictionary in two shapes. The account page shows the two meters. <span class="say">Say:</span> the map is never metered, only a question and an opened place are.</p></div></li>
</ol>
<div class="band" style="margin-top:auto"><h3>Have ready</h3><p>A Map Service key for the MAPID basemap, or the open one stands in. A model key on OpenRouter, or the rule parser answers the plain forms and says so. An empty database address, which is demo mode. If the network is slow, the stages on screen say where the wait is.</p></div>`,
			{ num: pg }
		)
	);

	/* 16 · running it */
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('15', 'Running it')}
<div class="head"><h1>No key is a way of running this.</h1><p class="lead">Openable from a bare clone with nothing filled in. Each missing secret costs exactly the thing it unlocks and nothing else, and the interface says which mode it is in.</p></div>
<ul class="tri" style="margin-top:8px">
<li><p class="eyebrow">No database</p><h3 style="margin-top:10px">Demo mode</h3><p>One account, one button to sign in, records in memory until the process restarts. The same tiers, the same allowances, the same meters and session tokens as with a cluster behind it.</p></li>
<li><p class="eyebrow">No model key</p><h3 style="margin-top:10px">The rule parser</h3><p>It reads the plain forms: a business type, a measure, a named place, a why. Every figure is still the engine's, and every reply says which path read it rather than glossing over it.</p></li>
<li><p class="eyebrow">No Map Service key</p><h3 style="margin-top:10px">An open basemap</h3><p>OpenStreetMap data with CARTO cartography stands in, in the reader's theme. The MAPID basemap is drawn the moment a key is present, and is what the final product ships on.</p></li>
</ul>
<div class="panel" style="margin-top:auto;padding:26px 36px;display:grid;grid-template-columns:1fr 760px;gap:56px;align-items:start">
<div><h3>Two metered actions, and the map is never one of them.</h3><p class="body" style="margin-top:12px;font-size:19px">One question to Tapak, because understanding a sentence is a call out to a shared model. One area or place opened by hand, because that is when its competitors, stations, listings and timetables are all read and drawn. Closing costs nothing and reopening what is open costs nothing. The week turns at midnight on Monday in Jakarta, and what was bought outright survives every Monday.</p></div>
<table class="tiers"><thead><tr><th>Plan</th><th class="num">Questions a week</th><th class="num">Areas or places a week</th><th class="num">Rp a month</th></tr></thead><tbody>
${f.plans.map((p) => `<tr><td class="name">${esc(p.name)}</td><td class="num">${num(p.week.ai)}</td><td class="num">${num(p.week.analysis)}</td><td class="num">${p.price ? num(p.price) : '0'}</td></tr>`).join('')}
${f.packs.map((p) => `<tr class="pack"><td class="name">${p.meter === 'ai' ? 'Top-up, questions' : 'Top-up, areas or places'}</td><td class="num">${p.meter === 'ai' ? num(p.amount) : '·'}</td><td class="num">${p.meter === 'analysis' ? num(p.amount) : '·'}</td><td class="num">${num(p.price)} once</td></tr>`).join('')}
</tbody></table>
</div>`,
			{ num: pg }
		)
	);

	/* 17 · under the hood */
	const s = f.stack;
	pages.push((pg) =>
		slide(
			'',
			`${sectionMark('16', 'Under the hood')}
<div style="display:grid;grid-template-columns:1fr 640px;gap:72px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:24px">
<h1 style="font-size:60px">Arrows only point downwards.</h1>
<p class="body" style="max-width:54ch">Every layer imports only from the layers beneath it, so the engine can be run on the server, in the browser and in a build script alike. This deck is built by loading the same modules and asking them.</p>
<div class="layers">
<div class="lay"><span class="k">types.ts</span><span class="d">The shapes and the key unions. The leaf: imports nothing from src.</span></div>
<span class="down">↓</span>
<div class="lay"><span class="k">utils/</span><span class="d">Format, geo, motion. One earth radius, shared with the data scripts.</span></div>
<span class="down">↓</span>
<div class="lay"><span class="k">domain/</span><span class="d">The engine. Pure functions over the types: scoring, ranking, the query reader, the grounding fence, the plans. No Svelte, no DOM, no fetch.</span></div>
<span class="down">↓</span>
<div class="lay"><span class="k">map/ state/</span><span class="d">What the map is given to draw, and the runes that own what the reader chose and what has been fetched.</span></div>
<span class="down">↓</span>
<div class="lay"><span class="k">components/</span><span class="d">The pixels. App, landing, account, and the shared surfaces between them.</span></div>
<div class="lay" style="margin-top:8px;border-style:dashed"><span class="k">server/</span><span class="d">The one data source, the model layer, the accounts. Never imported by the client.</span></div>
</div>
</div>
<div style="display:flex;flex-direction:column;gap:26px">
<div><p class="eyebrow" style="margin-bottom:8px">Stack</p><ul class="kv">
<li><span>SvelteKit, Svelte with runes</span><span>${esc(s.kit)} · ${esc(s.svelte)}</span></li>
<li><span>TypeScript, Vite</span><span>${esc(s.typescript)} · ${esc(s.vite)}</span></li>
<li><span>MapLibre GL, the map and the modelled basemap</span><span>${esc(s.maplibre)}</span></li>
<li><span>three.js, the miniatures and the street model</span><span>${esc(s.three)}</span></li>
<li><span>H3, the grid</span><span>${esc(s.h3)}</span></li>
<li><span>MongoDB, optional, accounts and meters</span><span>${esc(s.mongodb)}</span></li>
<li><span>OpenRouter, function calling, a chain of free models</span><span>${f.llm.chain}</span></li>
</ul></div>
<div><p class="eyebrow" style="margin-bottom:8px">Data</p><p class="body" style="font-size:19px">Built by scripts over Overpass and the MAPID catalogue and missions, in an order each file records in its own metadata under a regenerate field. Every distance is measured with one earth, the one the browser measures with.</p></div>
<div><p class="eyebrow" style="margin-bottom:8px">Checks</p><p class="body" style="font-size:19px">Typecheck, then eleven self-tests that hold the pieces against each other, the breakdown against the engine, the two hour passes against every cell, the fence against the composed sentences, then the production build. Green on every push, deployed to Vercel from main.</p></div>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 18 · closing */
	pages.push((pg) =>
		slide(
			'dark closing',
			`<span class="sign">${brandMark(72)}</span>
<h1>${esc(cp.closing.title)}</h1>
<p class="team"><b>${esc(cp.footer.teamLabel)}</b> · ${esc(cp.footer.team)}<br>${esc(cp.footer.campus)}</p>
<p class="data">${esc(cp.footer.dataNote)} Built on ${esc(f.built)} from the grid in the repository. Rebuild with npm run deck.</p>`,
			{ num: pg, foot: false }
		)
	);

	const total = pages.length;
	const body = pages.map((p, i) => p(`${String(i + 1).padStart(2, '0')} / ${total}`)).join('\n');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920">
<title>SpotOn · Don't guess where to open. Ask the map.</title>
<style>
@font-face { font-family: 'Albert Sans'; src: url(data:font/woff2;base64,${assets.albert}) format('woff2'); font-weight: 100 900; font-style: normal; }
@font-face { font-family: 'Inter'; src: url(data:font/woff2;base64,${assets.inter}) format('woff2'); font-weight: 100 900; font-style: normal; }
${assets.css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}
