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

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
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
	const busy = e.rows.find((r) => r.key === 'demand');
	const rows = [
		{ label: 'How busy it is', value: busy.value, sub: busy.sub },
		{ label: `${cap(f.demo.many)} already here`, value: e.rows.find((r) => r.key === 'rivals').value, sub: '' },
		{ label: 'Other businesses nearby', value: e.rows.find((r) => r.key === 'around').value, sub: '' },
		{ label: 'Premises on the market', value: e.rows.find((r) => r.key === 'space').value, sub: '' }
	];
	const hours = e.hours.thin
		? `<p class="line">Too few businesses here publish their opening hours to show how the day goes.</p>`
		: `${hourCurve(e.hours)}<p class="line">${esc(e.hours.day)}. ${esc(e.hours.peak)}</p>`;
	const notes = e.field.total
		? `${e.field.total} ${e.field.total === 1 ? 'note' : 'notes'} from people who went there, with photographs.`
		: 'Nobody has recorded anything here yet.';
	return `<div class="card">
<div class="chead"><span class="pivot">${glyph('cell', 18)}</span><div class="who"><h2>${esc(e.name)}</h2><p class="sub"><span class="dot" style="background:var(--ramp-${e.rampIndex})"></span>${esc(e.typology)}</p><p class="standing">${esc(e.standing)}</p></div><span class="score">${e.score}</span></div>
<span class="askbtn">${tapak(14)}${esc(f.tapakCopy.askAbout)}</span>
<div class="sec"><div class="sh"><span class="ico">${glyph('score', 16)}</span><span class="eyebrow">What the score is made of</span><span class="aside">${esc(f.demo.choice)}</span></div>
<div class="rows">${rows.map((r) => `<div class="r"><span class="k">${esc(r.label)}${r.sub ? `<span class="st">${esc(r.sub)}</span>` : ''}</span><span class="v">${esc(r.value)}</span></div>`).join('')}</div></div>
<div class="sec"><div class="sh"><span class="ico">${glyph('transit', 16)}</span><span class="eyebrow">${esc(c.mood.transit)}</span></div>
<div class="big"><span class="v">${e.transit.total}</span><span class="k">stations and stops within a short walk</span></div><p class="line">${esc(e.transit.split)}. ${esc(e.transit.band)}</p></div>
<div class="sec"><div class="sh"><span class="ico">${glyph('price', 16)}</span><span class="eyebrow">${esc(c.property.title)}</span></div>
<div class="big"><span class="v">${e.cost.price === null ? '·' : esc(rp(e.cost.price))}</span><span class="k">${esc(e.cost.cap)}</span></div>${e.cost.rankPct === null ? '' : `<p class="line">${e.cost.rankPct === 0 ? 'The cheapest of the areas with a known price.' : e.cost.rankPct === 100 ? 'The dearest of the areas with a known price.' : `Dearer than ${e.cost.rankPct}% of the areas with a known price.`}</p>`}</div>
<div class="sec"><div class="sh"><span class="ico">${glyph('hours', 16)}</span><span class="eyebrow">${esc(c.activity.title)}</span></div>${hours}</div>
<div class="sec"><div class="sh"><span class="ico">${glyph('field', 16)}</span><span class="eyebrow">${esc(c.field.title)}</span></div><p class="line">${esc(notes)}</p></div>
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

	/* Section numbers, in the order the slides run. */
	let section = 0;
	const mark = (label) => sectionMark(String(++section).padStart(2, '0'), label);

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
			`${mark(cp.problem.mark)}
<div class="head"><h1>${esc(cp.problem.title)}</h1><p class="lead">${esc(cp.problem.statement)}</p></div>
<ul class="tri big" style="margin-top:32px">${cp.problem.rows.map((r) => `<li><h3>${esc(r.t)}</h3><p>${esc(r.d)}</p></li>`).join('')}</ul>
<div class="band" style="margin-top:56px"><h3>${esc(cp.problem.chartTitle)}</h3><p>Some streets around a station are full of trade and some are quiet, and from the pavement they look the same. SpotOn counts the difference, so the choice does not have to be a guess.</p></div>`,
			{ num: pg }
		)
	);

	/* 3 · the idea */
	pages.push((pg) =>
		slide(
			'',
			`${mark(cp.how.mark)}
<div class="head solo"><h1>${esc(cp.how.plain)}</h1></div>
<ul class="quad" style="margin-top:14px">
<li><span class="ico">${glyph('market', 24)}</span><h3>How busy it is</h3><p>The shops and cafés already trading around a spot are the surest sign that people come past. That is what SpotOn counts first.</p></li>
<li><span class="ico">${glyph('rivals', 24)}</span><h3>Who is already there</h3><p>The businesses of your own kind within a short walk. A street full of them is a street with less room for one more.</p></li>
<li><span class="ico">${glyph('sign', 24)}</span><h3>Whether there is space</h3><p>Premises actually on the market. A good area with nothing to take is not an opportunity, however busy it looks.</p></li>
<li><span class="ico accent">${glyph('transit', 24)}</span><h3>How well it is connected</h3><p>The stations and stops within a walk, with a train station counting for more than a bus stop.</p></li>
</ul>
<div class="band" style="margin-top:auto"><h3>One score per area, per kind of business.</h3><p>Each area gets a score out of 100 for the business you have in mind, a label that says what kind of place it is, and the reasons behind both.</p>
<ul class="chips" style="margin-left:auto;flex:none">${['underserved', 'competitive', 'saturated', 'busy-limited-space'].map((k) => `<li class="chip soft">${esc(cp.typology[k])}</li>`).join('')}</ul></div>`,
			{ num: pg }
		)
	);

	/* 4 · the map */
	pages.push((pg) =>
		slide(
			'',
			`${mark('The map')}
<div style="display:grid;grid-template-columns:600px 1fr;gap:64px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:28px">
<h1 style="font-size:64px">Jakarta, in areas you can walk across.</h1>
<p class="lead">Every hexagon is a small area with a station or a stop within a short walk. Each one is counted and scored on its own, never from a city average.</p>
<ul class="stats" style="grid-template-columns:1fr;gap:22px;margin-top:6px">
<li class="stat"><span class="v" style="font-size:68px">${num(g.hexes)}</span><span class="l" style="margin-top:10px">walkable areas around transit</span></li>
<li class="stat"><span class="v" style="font-size:68px">${num(g.stops)}</span><span class="l" style="margin-top:10px">stations and stops of the MRT, KRL, LRT and TransJakarta</span></li>
<li class="stat"><span class="v" style="font-size:68px">${num(g.mapidPoints)}</span><span class="l" style="margin-top:10px">businesses on the map, of ${f.categories.length} kinds</span></li>
</ul>
</div>
<figure class="panel" style="padding:22px;height:846px;display:flex;flex-direction:column;gap:12px"><div style="flex:1;min-height:0">${hexMap(f.maps, { paint: 'none' })}</div><figcaption class="small" style="text-align:center">Every hexagon at its real place, with the four transit networks in their own colours.</figcaption></figure>
</div>`,
			{ num: pg }
		)
	);

	/* 5 · the evidence */
	pages.push((pg) =>
		slide(
			'',
			`${mark('The evidence')}
<div class="head"><h1>Three kinds of evidence, all of it real.</h1><p class="lead">Real places, counted one by one. Where nothing has been counted yet, the map says so instead of guessing.</p></div>
<ul class="tri" style="margin-top:8px">
<li><p class="eyebrow">The city as mapped</p><h3 style="margin-top:10px">Stations, streets and shops</h3><p>The stations and stops of all four transit networks, the businesses along the streets, and the hours they say they are open, from OpenStreetMap.</p></li>
<li><p class="eyebrow">MAPID's catalogue</p><h3 style="margin-top:10px">Businesses and premises</h3><p>Businesses of every kind across Jakarta, each with its name, and the premises currently on the market with their asking prices.</p></li>
<li><p class="eyebrow">People on the street</p><h3 style="margin-top:10px">Field notes</h3><p>Receipts, menus and shopfronts recorded by surveyors who went there, with photographs. Shown beside an area as notes, never mixed into its score.</p></li>
</ul>
<div class="panel" style="margin-top:auto;padding:24px 36px;display:grid;grid-template-columns:1fr 400px;gap:40px;align-items:center">
<div><h3>Where nobody has counted, nothing is claimed.</h3><p class="body" style="margin-top:10px;font-size:20px">Areas the catalogue has not covered yet are drawn hatched and left unscored. They are never filled in with an estimate, and never quietly dropped from a ranking.</p>
<div class="legend" style="flex-direction:row;gap:28px;margin-top:14px"><div class="row" style="font-size:16px"><span class="dot" style="background:var(--ramp-3)"></span>areas that have been counted</div><div class="row" style="font-size:16px"><span class="hatchkey"></span>not surveyed yet</div></div></div>
<div style="height:250px">${hexMap(f.maps, { paint: 'trade', routes: false, stops: false })}</div>
</div>`,
			{ num: pg }
		)
	);

	/* 6 · what the score is made of */
	const ex = f.example;
	pages.push((pg) =>
		slide(
			'',
			`${mark('The score')}
<div style="display:grid;grid-template-columns:1fr 620px;gap:72px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:26px">
<h1 style="font-size:60px">What the score is made of.</h1>
<p class="lead">One score per area, per kind of business, out of 100. Every part of it is something that was counted.</p>
<ol class="script" style="grid-template-columns:minmax(0, 1fr);gap:14px;margin-top:4px">
<li><span class="n">1</span><div><h3>Start with how busy the area is.</h3><p>The trade already standing within a walk, other than your own kind.</p></div></li>
<li><span class="n">2</span><div><h3>Take away the competition.</h3><p>The more of your kind already there, the smaller the gap left for you.</p></div></li>
<li><span class="n">3</span><div><h3>Check there is somewhere to rent.</h3><p>An area with nothing on the market drops to the bottom, however busy it is.</p></div></li>
<li><span class="n">4</span><div><h3>Weigh the transit and the price.</h3><p>More stations within a walk count for more. Dearer space counts against, a little.</p></div></li>
</ol>
</div>
<figure class="panel" style="padding:30px 34px 26px;display:flex;flex-direction:column;gap:16px">
<div><p class="eyebrow">One area, one business</p><h2 style="margin-top:8px">${esc(ex.name)}</h2><p class="body" style="margin-top:2px">for a ${esc(f.demo.choice.toLowerCase())}</p></div>
<div style="display:flex;align-items:baseline;gap:20px"><span style="font-family:var(--font-display);font-size:124px;font-weight:300;letter-spacing:-0.05em;line-height:1;color:var(--accent)">${ex.score}</span><span class="body" style="line-height:1.4">out of 100<br><strong>${esc(ex.typology)}</strong>, ${esc(ex.standing)}</span></div>
<ul class="kv" style="margin-top:4px">
<li><span>How busy it is</span><span>${esc(ex.rows[1].value)} of 100, ${esc(ex.rows[1].sub)}</span></li>
<li><span>${esc(cap(f.demo.many))} already here</span><span>${esc(ex.rows[4].value)}</span></li>
<li><span>Stations and stops within a walk</span><span>${ex.transit.total}</span></li>
<li><span>Premises on the market</span><span>${esc(ex.rows[6].value)}</span></li>
</ul>
<p class="small">Worked out by SpotOn from the counted data, exactly as it is in the app.</p>
</figure>
</div>`,
			{ num: pg }
		)
	);

	/* 7 · Tapak */
	pages.push((pg) =>
		slide(
			'',
			`${mark(cp.ai.mark)}
<div style="display:grid;grid-template-columns:1fr 700px;gap:72px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:28px">
<span class="plinth" style="width:120px;height:120px">${tapak(68, true)}</span>
<h1 style="font-size:64px">${esc(cp.ai.title)}</h1>
<p class="body" style="max-width:52ch">${esc(cp.ai.p1)}</p>
<ul class="notes" style="gap:18px;margin-top:4px">
<li class="accent"><h3>${esc(cp.ai.meet.title)}</h3><p>Tapak reads your question, works out what to look up, and answers with the reasons attached, in Indonesian or English.</p></li>
<li><h3>The numbers are counted, never invented.</h3><p>Tapak writes the sentence. Every figure in it comes from the map's own counting, and one that does not is thrown out before you see it.</p></li>
<li><h3>It says when it cannot tell.</h3><p>A question the data cannot answer gets an honest answer, not a confident guess.</p></li>
</ul>
</div>
<div class="panel" style="padding:26px;display:flex;flex-direction:column;gap:16px;background:var(--mat-thick)">
<div class="tp" style="position:static;width:auto;padding:0;background:none;box-shadow:none">
<div class="row">${tapak(24)}<div class="bubble">${esc(f.greeting)}</div></div>
<ul class="chips" style="padding-left:44px;gap:8px">${f.categories.map((c) => `<li class="chip" style="font-size:14.5px;padding:6px 13px;gap:8px">${catGlyph(c.key, 15)}${esc(c.name)}</li>`).join('')}</ul>
<div class="row mine"><div class="bubble said">${esc(f.demo.choice)}</div></div>
<div class="row">${tapak(24, true)}<div class="bubble" style="color:var(--label-3)">${esc(f.stages.computing)} <span style="letter-spacing:2px">···</span></div></div>
</div>
<p class="small" style="border-top:1px solid var(--separator);padding-top:14px">Tapak greets by the time of day, offers the kinds of business the map can score, and paces while it looks the answer up.</p>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 8 · the interface, act one */
	pages.push((pg) =>
		slide(
			'',
			`${mark('The interface')}
<div style="display:grid;grid-template-columns:1210px 1fr;gap:56px;flex:1;min-height:0;align-items:start">
<div class="app" style="height:846px">${hexMap(f.maps, { paint: 'trade', par: 'xMidYMid slice', routeWidth: 1.4 })}<div class="scrim"></div>${chrome(f)}${launcher(f)}</div>
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Act one. One question, where the eye already is.</h2>
<ul class="notes">
<li class="accent"><h3>Nothing to fill in.</h3><p>No menus, no sliders, no tables. A greeting, one question, and a box that takes anything you type.</p></li>
<li><h3>Examples show the way.</h3><p>They type themselves into the box and clear again, and the same four sit under it as buttons, so nobody has to type to get started.</p></li>
<li><h3>Or just open the map.</h3><p>The city behind the box is already coloured by how busy each area is. Looking around is always free.</p></li>
</ul>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 9 · act two */
	pages.push((pg) =>
		slide(
			'',
			`${mark('The interface')}
<div style="display:grid;grid-template-columns:1210px 1fr;gap:56px;flex:1;min-height:0;align-items:start">
<div class="app" style="height:846px">${hexMap(f.maps, { paint: 'score', par: 'xMidYMid slice', marks: true, routeWidth: 1.4 })}${chrome(f)}<div class="mcat"><span class="chip on">${catGlyph(f.categories[0].key, 15)}${esc(f.demo.choice)}</span></div>${mapKey(f)}<div class="mctl"><span class="seg"><span class="on">Flat</span><span>3D</span></span><span class="seg"><span class="on">Drawn</span><span>Modelled</span></span></div>${tapakPanel(f)}</div>
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Act two. Ask, and the whole city recolours.</h2>
<ul class="notes">
<li class="accent"><h3>The question becomes a conversation.</h3><p>The box moves to the side and the map takes over. Every area the answer names is marked, and tapping one opens it.</p></li>
<li><h3>You see what was understood.</h3><p>${esc(cp.ai.p2)}</p></li>
<li><h3>Places, with scores out of 100.</h3><p>${esc(f.demo.results[0].name)} leads at ${f.demo.results[0].pct}. Each place can be opened to see why.</p></li>
<li><h3>Follow-up questions work.</h3><p>Why that one, which ones to avoid, any rent. Tapak remembers what was just said.</p></li>
</ul>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 10 · the area card */
	pages.push((pg) =>
		slide(
			'',
			`${mark('One area')}
<div style="display:grid;grid-template-columns:660px 1fr;gap:72px;flex:1;min-height:0;align-items:start">
${areaCard(f)}
<div style="display:flex;flex-direction:column;gap:28px">
<h2>Tap an area, and see what it is made of.</h2>
<ul class="notes">
<li class="accent"><h3>Everything about one place.</h3><p>How busy it is, who is already trading there, the stations and stops it reaches, what space costs, when the street is open, and what people recorded on the ground.</p></li>
<li><h3>Every figure is set in context.</h3><p>A score on its own means little. The card says where each figure stands against every other area, so a good number reads as good.</p></li>
<li><h3>Ask Tapak about it.</h3><p>One tap puts the area into the conversation, and the next question you type is read about that place.</p></li>
</ul>
</div>
</div>`,
			{ num: pg }
		)
	);

	/* 11 · the place as a model */
	const model = f.model;
	const marks = model.marks;
	const area = model.area;
	const states = model.states;
	const areaLine = area
		? `${esc(area.name)}, everything within ${g.walkRadius} m of the point in the middle, built from ${esc(area.source)}.`
		: `${cap(states.failed)} when this copy was built, so the disc stands empty rather than showing a place that was not read. Rebuilt where the map can be reached, the same slide draws the place.`;
	pages.push((pg) =>
		slide(
			'',
			`${mark(cp.model.mark)}
<div style="display:grid;grid-template-columns:1fr 880px;gap:56px;flex:1;min-height:0;align-items:start">
<div style="display:flex;flex-direction:column;gap:26px">
<h1 style="font-size:64px">${esc(cp.model.title)}</h1>
<p class="lead">${esc(cp.model.lead)}</p>
<ul class="notes" style="gap:18px">
<li class="accent"><h3>${esc(model.name)}, the business district.</h3><p>The same area the front page shows, chosen because its towers show what the model can do.</p></li>
<li><h3>Built from the map itself.</h3><p>Buildings, streets, water and parks come straight from the map, and every building stands at its recorded height. Nothing is drawn that the map does not have.</p></li>
<li><h3>Turn it, and move through the day.</h3><p>Drag to turn the model. Slide the hour, and the doors that are open at that time light up, from the hours each business publishes.</p></li>
</ul>
</div>
<figure class="panel" style="padding:16px 26px 22px;display:flex;flex-direction:column;gap:10px">
<div style="display:flex;justify-content:center">${miniModel(marks, model.name, area, model.roadWidth)}</div>
<div class="keyrow"><span><i class="be"></i>the middle of the area</span><span><i class="st"></i>stations and stops</span><span><i class="sq"></i>${esc(f.demo.many)}</span><span><i class="di"></i>premises on the market</span><span><i class="ri"></i>field notes</span><span><i class="lit"></i>doors open at ${esc(marks.hour)} on a ${esc(marks.day)}</span></div>
<figcaption class="small">${areaLine}</figcaption>
</figure>
</div>`,
			{ num: pg }
		)
	);

	/* 12 · honest by design */
	pages.push((pg) =>
		slide(
			'',
			`${mark('Honesty')}
<div class="head"><h1>Honest by design.</h1><p class="lead">A recommendation is only worth following if you can trust where its numbers came from. Four promises hold that up, everywhere in SpotOn.</p></div>
<ol class="rules" style="margin-top:8px;gap:40px 72px">
<li><span class="n">1</span><span><strong>No invented numbers.</strong> Every figure on screen was counted from real data. Tapak can phrase an answer, but it cannot make a number up.</span></li>
<li><span class="n">2</span><span><strong>Missing is not zero.</strong> An area nobody has surveyed is shown as unknown, not as empty, and is left out of a ranking rather than ranked as quiet.</span></li>
<li><span class="n">3</span><span><strong>It says what it does not know.</strong> A question the data cannot answer gets a plain answer to that effect, never a confident guess.</span></li>
<li><span class="n">4</span><span><strong>Reasons attached.</strong> Every score can be taken apart to see what it is made of, and every claim points back to something that was counted.</span></li>
</ol>`,
			{ num: pg }
		)
	);

	/* 13 · who it is for */
	pages.push((pg) =>
		slide(
			'',
			`${mark(cp.audience.mark)}
<div class="head"><h1>${esc(cp.audience.title)}</h1><p class="lead">From a first warung to a chain's next ten branches. Free to try, and looking at the map is never charged for.</p></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:56px;margin-top:6px">
<div><p class="eyebrow" style="margin-bottom:12px">Who asks</p><ul class="chips">${cp.audience.rows.map((r) => `<li class="chip">${esc(r)}</li>`).join('')}</ul></div>
<div><p class="eyebrow" style="margin-bottom:12px">${esc(cp.audience.typesLabel)}</p><ul class="chips">${f.categories.map((c) => `<li class="chip" style="gap:8px">${catGlyph(c.key, 15)}${esc(c.name)}</li>`).join('')}</ul></div>
</div>
<ul class="tri" style="margin-top:auto;gap:40px">${f.plans
				.map(
					(p) => `<li><p class="eyebrow">${esc(p.name)}</p><h3 style="margin-top:10px">${p.price ? `Rp ${num(p.price)} a month` : 'Free, no card needed'}</h3><p>${esc(p.blurb)} ${num(p.week.ai)} questions and ${num(p.week.analysis)} areas a week.</p></li>`
				)
				.join('')}</ul>`,
			{ num: pg }
		)
	);

	/* 14 · the demo */
	pages.push((pg) =>
		slide(
			'',
			`${mark('The demo')}
<div class="head"><h1>Six minutes, from the front page to a shortlist.</h1><p class="lead">What to show, and the one sentence to say at each step. Nothing on screen is staged: every figure is worked out live from the data.</p></div>
<ol class="script" style="margin-top:6px">
<li><span class="n">1</span><div><h3>Open the front page and scroll one block.</h3><p>The street model walks through a whole day as the page scrolls. <span class="say">Say:</span> busy is something you can count.</p></div></li>
<li><span class="n">2</span><div><h3>Sign in with one tap and meet Tapak.</h3><p>Tapak greets by the time of day and asks the one question that matters. <span class="say">Say:</span> ${esc(f.launch.title.toLowerCase())}</p></div></li>
<li><span class="n">3</span><div><h3>Tap “${esc(f.demo.choice)}”, then “${esc(f.tapakCopy.budgetTight)}”.</h3><p>The whole city recolours and the top three arrive. <span class="say">Say:</span> the map shows how it understood you before it answers.</p></div></li>
<li><span class="n">4</span><div><h3>Ask “${esc(f.tapakCopy.why)}”</h3><p>Typed or tapped. The answer comes back with its reasons. <span class="say">Say:</span> Tapak wrote the sentence, the counting wrote every number.</p></div></li>
<li><span class="n">5</span><div><h3>Tap the top area and walk the card.</h3><p>How busy, who is here, how to get here, what space costs, when the street opens, what people noted. <span class="say">Say:</span> every figure says where it stands against the rest of the city.</p></div></li>
<li><span class="n">6</span><div><h3>Open the model, turn it, slide the hour.</h3><p>The place itself, built from the map, with its doors lighting up. <span class="say">Say:</span> this is where you would actually be standing.</p></div></li>
</ol>
<div class="band" style="margin-top:auto"><h3>Nothing to set up</h3><p>The demo sign-in is one button, and the map keeps working even without an AI key or a database, so nothing can stop the demo on the day.</p></div>`,
			{ num: pg }
		)
	);

	/* 15 · closing */
	pages.push((pg) =>
		slide(
			'dark closing',
			`<span class="sign">${brandMark(72)}</span>
<h1>${esc(cp.closing.title)}</h1>
<p class="team"><b>${esc(cp.footer.teamLabel)}</b> · ${esc(cp.footer.team)}<br>${esc(cp.footer.campus)}</p>
<p class="data">${esc(cp.footer.dataNote)}</p>`,
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
