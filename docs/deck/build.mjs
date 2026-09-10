/**
 * The demo deck, built from the data rather than written by hand.
 *
 *   npm run deck                         → docs/deck/spoton-deck.html and spoton-deck.pdf
 *   node docs/deck/build.mjs --read-area → docs/deck/area.json only, from the basemap
 *
 * Every figure on every slide comes from here: the grid file's own metadata, the
 * scoring engine run on that grid, and the constants the engine exports. Nothing is
 * typed into the slides, for the reason nothing is typed into the landing page. A
 * number copied into a deck goes stale in silence, and a deck is where it is read
 * out loud.
 *
 * The engine is TypeScript under `$lib`, so it is loaded through Vite's SSR module
 * loader exactly as the dev server loads it, with the SvelteKit plugin resolving the
 * aliases. The slides themselves are in `slides.mjs`, the look in `deck.css`.
 *
 * One slide models the example area the way the app does, from the basemap's own
 * vector tiles, read through the very reader the app reads them with. That is the one
 * thing here that needs the network, so the reading is kept in `area.json` beside this
 * file and the deck builds again from it without one. `--read-area` refreshes it and
 * nothing else, which is what `.github/workflows/deck-area.yml` runs. With no reading
 * on disk and no network, the model says so rather than standing empty as if finished.
 *
 * The PDF is printed by headless Chromium. Set `CHROMIUM_BIN` to point at a browser,
 * or let the script find one on the PATH or in a Playwright browsers directory. With
 * no browser at all the HTML is still written and the script says so.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { renderDeck } from './slides.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT_HTML = join(HERE, 'spoton-deck.html');
const OUT_PDF = join(HERE, 'spoton-deck.pdf');
const AREA_FILE = join(HERE, 'area.json');
const READ_AREA_ONLY = process.argv.includes('--read-area');

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const readText = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const vite = await createServer({
	configFile: join(ROOT, 'vite.config.ts'),
	root: ROOT,
	server: { middlewareMode: true, hmr: false, watch: null },
	appType: 'custom',
	logLevel: 'error'
});

try {
	await build();
} finally {
	await vite.close();
}

async function build() {
	const load = (p) => vite.ssrLoadModule(p);
	const [
		scoring,
		weights,
		nlq,
		narrate,
		i18n,
		source,
		categories,
		plans,
		metrics,
		composition,
		transit,
		cost,
		activity,
		premises,
		competitors,
		gridmap,
		format,
		geo,
		basemap,
		mapBasemap,
		areaState
	] = await Promise.all([
		load('/src/lib/domain/scoring.ts'),
		load('/src/lib/domain/weights.ts'),
		load('/src/lib/domain/nlq.ts'),
		load('/src/lib/domain/narrate.ts'),
		load('/src/lib/i18n/index.ts'),
		load('/src/lib/server/source.ts'),
		load('/src/lib/domain/categories.ts'),
		load('/src/lib/domain/plans.ts'),
		load('/src/lib/domain/metrics.ts'),
		load('/src/lib/domain/composition.ts'),
		load('/src/lib/domain/transit.ts'),
		load('/src/lib/domain/cost.ts'),
		load('/src/lib/domain/activity.ts'),
		load('/src/lib/domain/premises.ts'),
		load('/src/lib/domain/competitors.ts'),
		load('/src/lib/server/gridmap.ts'),
		load('/src/lib/utils/format.ts'),
		load('/src/lib/utils/geo.ts'),
		load('/src/lib/domain/basemap.ts'),
		load('/src/lib/map/basemap.ts'),
		load('/src/lib/state/area.ts')
	]);

	const c = i18n.DICT.en;
	const hexes = source.loadHexes();
	const meta = source.grid;
	const W = weights.DEFAULT_WEIGHTS;
	const R = W.radius;

	/* ── the grid ─────────────────────────────────────────────────────────── */

	const surveyed = hexes.filter((h) => h.dens.mapid !== null).length;

	/* ── the engine on the grid ───────────────────────────────────────────── */

	const CAT = weights.DEFAULT_CATEGORY;
	const catName = c.category[CAT];
	const rows = scoring.scoreAll(hexes, CAT, W);
	const trade = gridmap.tradeShare(hexes);

	// The same question the landing page asks first, answered by the same engine.
	const query = {
		intent: 'RANK',
		metrik: 'gap permintaan − penawaran',
		kategori: [CAT],
		radius_m: R,
		filter: { dalam_catchment_transit: `${R} m`, ruang_sewa_tersedia: true, tier_harga: 'rendah' },
		urut: 'desc',
		limit: 3
	};
	const ans = nlq.runQuery(query, catName.name, hexes, W);
	const demo = {
		question: c.demo.askCheap(catName.many),
		choice: catName.name,
		many: catName.many,
		chips: narrate.describeQuery(ans.query, c),
		sentence: narrate.narrate(ans, c),
		results: ans.items.slice(0, 3).map((i) => ({ id: i.id, name: i.name, pct: format.pct(i.value) })),
		more: Math.max(0, ans.items.length - 3),
		highlight: new Set(ans.highlight.slice(0, 3))
	};

	/* ── one area, taken apart ────────────────────────────────────────────── */

	const top = demo.results[0];
	const hex = hexes.find((h) => h.id === top.id);
	const row = rows.find((r) => r.id === top.id);
	const routesFile = readJson('static/data/routes.json');

	/* ── the place itself, read off the basemap ───────────────────────────── */

	/*
	 * The area the model slide stands up is chosen by name, not by score, exactly as
	 * the front page chooses the first area it models, and for the same reason: a height
	 * read off a tile is only visible where there are heights, and the business district
	 * has them, where the demo's own top catchment is a kampung that at the size of a
	 * whole disc is a texture. The name is read from the landing page's own list so the
	 * deck and the front page cannot come to model different places. A name the grid no
	 * longer carries falls back to the demo's top catchment rather than to nothing.
	 */
	const landing = readText('src/routes/+page.server.ts');
	const showcase =
		landing
			.match(/const SHOWCASE = \[([^\]]*)\]/)?.[1]
			.match(/'([^']+)'/g)
			?.map((n) => n.slice(1, -1)) ?? [];
	const modelHex = hexes.find((h) => h.name === showcase[0]) ?? hex;
	const modelRow = rows.find((r) => r.id === modelHex.id);
	const modelName = modelRow.name;
	const modelCentre = { lat: modelHex.lat, lon: modelHex.lon };

	/**
	 * The basemap around the point, through the app's own reader: the style the public
	 * configuration allows, MAPID's with a key and the open one otherwise, its tiles
	 * decoded and cut to the disc by `domain/basemap`. Coordinates are kept to a tenth
	 * of a metre, which is finer than anything the drawing can show.
	 */
	async function readAreaFromBasemap() {
		const tiles = await mapBasemap.basemapTilesFor('light');
		if (!tiles) throw new Error('the basemap style could not be fetched');
		const reader = new areaState.AreaReader();
		const routes = basemap.parseRoutes(routesFile);
		const key = basemap.areaKeyOf(modelCentre, R, tiles);
		const g = await reader.read(tiles, modelCentre, R, routes, key);
		const round = (p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
		const rings = (rs) => rs.map((r) => r.map(round));
		const host = tiles.key;
		const from = /mapid\.io/.test(host)
			? 'MAPID MAPS'
			: /cartocdn/.test(host)
				? 'OpenStreetMap data, CARTO cartography'
				: host;
		return {
			cell: modelHex.id,
			name: modelName,
			radius: R,
			basemap: host,
			source: from,
			read: new Date().toISOString().slice(0, 10),
			zoom: g.zoom,
			tiles: g.tiles,
			buildings: g.buildings.map((b) => ({ rings: rings(b.rings), height: b.height, base: b.base })),
			roads: g.roads.map((r) => ({ path: r.path.map(round), kind: r.kind, bridge: r.bridge })),
			water: g.water.map((w) => ({ rings: rings(w.rings) })),
			waterways: g.waterways.map((w) => ({ path: w.path.map(round), width: w.width })),
			green: g.green.map((w) => ({ rings: rings(w.rings) })),
			routes: g.routes.map((r) => ({ path: r.path.map(round), mode: r.mode }))
		};
	}

	/** The reading on disk when it is this area's, the basemap otherwise, null when
	    neither can be had. */
	async function areaFor(refresh) {
		if (!refresh && existsSync(AREA_FILE)) {
			const cached = JSON.parse(readFileSync(AREA_FILE, 'utf8'));
			if (cached.cell === modelHex.id && cached.radius === R) return cached;
		}
		try {
			const fresh = await readAreaFromBasemap();
			writeFileSync(AREA_FILE, JSON.stringify(fresh));
			console.log(
				`read the basemap around ${fresh.name}: ${fresh.buildings.length} buildings, ${fresh.roads.length} street pieces, ${fresh.tiles} tiles at z${fresh.zoom}, from ${fresh.source}`
			);
			return fresh;
		} catch (err) {
			if (READ_AREA_ONLY) throw err;
			console.log(
				`the basemap could not be read (${err.message}) and no reading of ${modelName} is on disk, so the model will say so`
			);
			return null;
		}
	}

	const area = await areaFor(READ_AREA_ONLY || process.env.DECK_REFRESH === '1');
	if (READ_AREA_ONLY) return;

	const ladder = (key) => metrics.ladderFor(rows, key);
	const standing = (key) => narrate.standingPhrase(metrics.standingOf(row, key, ladder(key)), c);

	const comp = composition.composeScore(row, W);

	const stopsFile = readJson('static/data/stops.json');
	const stops = transit.parseStops(stopsFile);
	const caughtStops = transit.capturedStops(hex, stops, R);
	const rail = transit.railTotal(row.transit);
	const total = transit.stopTotal(row.transit);
	const band = transit.accessBand(row.access);

	const propertyFile = readJson('static/data/property.json');
	const listings = premises.parseListings(propertyFile);
	const caughtListings = premises.capturedListings(hex, listings, R);
	const priced = cost.pricedOf(hex, R);
	const rankPct = row.priceLevel === null ? null : Math.round(row.priceLevel * 100);

	const poiFile = readJson(`static/data/pois/${CAT}.json`);
	const rivals = competitors.capturedCompetitors(hex, competitors.parseCompetitors(poiFile), R);

	const hoursFile = readJson('static/data/hours.json');
	const places = activity.parseHours(hoursFile);
	const caughtOpen = activity.capturedOpen(hex, places, R);
	const week = activity.weekProfile(caughtOpen);
	const hoursAt = activity.readHours(hex, R);
	const DAY = 0; // Monday, the first day the OSM tag itself writes.
	const HOUR = 10;
	const peak = activity.peakOf(week[DAY]);

	const fieldFile = readJson('static/data/field.json');
	const fieldHere = fieldFile.records.filter((r) => r.cell === hex.id);

	/* The marks that stand on the model: what the modelled area captures, converted to
	   metres from its own centre, x east and y north, through the very projection the
	   area model converts its marks with. */
	const local = (lat, lon) => {
		const p = geo.localMetres(lat, lon, modelCentre);
		return { x: Math.round(p.x), y: Math.round(p.y) };
	};
	const modelOpen = activity.capturedOpen(modelHex, places, R);
	const marks = {
		radius: R,
		stops: transit.capturedStops(modelHex, stops, R).map((s) => ({ ...local(s.lat, s.lon), mode: s.mode })),
		rivals: competitors
			.capturedCompetitors(modelHex, competitors.parseCompetitors(poiFile), R)
			.map((p) => local(p.lat, p.lon)),
		units: premises.capturedListings(modelHex, listings, R).map((l) => local(l.lat, l.lon)),
		field: fieldFile.records.filter((r) => r.cell === modelHex.id).map((r) => local(r.lat, r.lon)),
		doors: modelOpen.map((p) => ({ ...local(p.lat, p.lon), open: Boolean(p.week[DAY] & (1 << HOUR)) })),
		hour: c.activity.hourShort(HOUR),
		day: c.activity.dayFull[DAY]
	};

	const example = {
		name: row.name,
		city: hex.city,
		score: format.pct(row.score),
		standing: standing('skor'),
		typology: c.typology[row.typology],
		rampIndex: format.rampIndex(row.score),
		rows: [
			{ key: 'score', label: c.mood.rows.score, value: format.pct(row.score), sub: standing('skor') },
			{ key: 'demand', label: c.mood.rows.demand, value: format.pct(row.demand), sub: standing('permintaan') },
			{ key: 'supply', label: c.mood.rows.supply, value: format.pct(row.supply), sub: standing('penawaran') },
			{ key: 'around', label: c.mood.rows.around, value: String(row.density), sub: '' },
			{ key: 'rivals', label: c.mood.rows.rivals, value: String(row.osm), sub: '' },
			{ key: 'access', label: c.mood.rows.access, value: format.pct(row.access), sub: standing('akses_transit') },
			{ key: 'space', label: c.mood.rows.space, value: String(row.units), sub: '' }
		],
		transit: {
			total,
			rail,
			brt: row.transit.brt,
			count: c.mood.transitCount(total),
			split: c.mood.transitCountSplit(rail, row.transit.brt),
			band: c.mood.transitBandCell[band],
			modes: transit.presentModes(row.transit)
		},
		cost: {
			price: row.price,
			priced,
			rankPct,
			units: row.units,
			cap: row.price === null ? c.panel.costUnits(row.units) : c.panel.costCap(row.units),
			rank:
				rankPct === null
					? null
					: rankPct === 0
						? c.property.rankCheapest
						: rankPct === 100
							? c.property.rankDearest
							: c.property.rank(rankPct),
			effect: comp.costBites ? c.property.effect(comp.costPoints) : c.property.effectNone
		},
		hours: {
			n: hoursAt?.n ?? 0,
			p: hoursAt?.p ?? 0,
			h: hoursAt?.h ?? 0,
			thin: (hoursAt?.h ?? 0) < meta.hours.minReadable,
			thinNote:
				(hoursAt?.h ?? 0) === 0
					? c.activity.none(hoursAt?.n ?? 0, R)
					: c.activity.thin(hoursAt?.h ?? 0, hoursAt?.n ?? 0, R),
			denominator: `${hoursAt?.h ?? 0} of ${hoursAt?.n ?? 0} publish readable hours`,
			day: c.activity.dayFull[DAY],
			curve: week[DAY],
			peak: c.activity.peak(peak.hour, peak.n, caughtOpen.length),
			hourLabel: c.activity.hourShort
		},
		field: {
			total: fieldHere.length,
			count: fieldHere.length ? c.field.count(fieldHere.length) : c.panel.fieldNone
		}
	};

	/* ── the maps: every cell where it actually is ────────────────────────── */

	const lats = hexes.map((h) => h.lat);
	const lons = hexes.map((h) => h.lon);
	const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
	const kLon = Math.cos((latMid * Math.PI) / 180);
	const x0 = Math.min(...lons) * kLon;
	const y0 = Math.max(...lats);
	// Half a cell of margin on every side, so the boundary of an edge cell is inside
	// the drawing rather than clipped by it.
	const pad = 0.006;
	const width = (Math.max(...lons) * kLon - x0 + 2 * pad * kLon) || 1;
	const k = 1000 / width;
	const project = (lat, lon) => ({
		x: Math.round((lon * kLon - x0 + pad * kLon) * k * 10) / 10,
		y: Math.round((y0 - lat + pad) * k * 10) / 10
	});
	// The corridors are hairlines, and there are thousands of segments, so their
	// coordinates are kept to whole units: one unit is under a pixel at any size the
	// map is drawn at, and the halving of the file shows on every page it is printed on.
	const routes = {};
	for (const f of routesFile.features) {
		const parts = [];
		for (const line of f.geometry.coordinates) {
			const pts = line.map(([lon, lat]) => project(lat, lon));
			parts.push('M' + pts.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`).join('L'));
		}
		routes[f.properties.mode] = parts.join('');
	}
	const maps = {
		width: 1000,
		height: Math.ceil(project(Math.min(...lats) - 2 * pad, 0).y),
		cells: hexes.map((h, i) => {
			const pts = h.boundary.map(([lon, lat]) => project(lat, lon));
			return {
				name: h.name,
				d: 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L') + 'Z',
				centre: project(h.lat, h.lon),
				surveyed: h.dens.mapid !== null,
				trade: trade[i] === null ? null : format.rampIndex(trade[i]),
				score: rows[i].score === null ? null : format.rampIndex(rows[i].score),
				marked: demo.highlight.has(h.id),
				example: h.id === hex.id
			};
		}),
		stops: stopsFile.stops.map((s) => ({ ...project(s.y, s.x), mode: s.m })),
		routes
	};

	const facts = {
		built: new Date().toISOString().slice(0, 10),
		brand: c.brand,
		grid: {
			hexes: meta.hexes,
			walkRadius: R,
			stops: meta.stops,
			pois: meta.pois,
			mapidPoints: meta.mapid.points,
			surveyed,
			unsurveyed: meta.hexes - surveyed
		},
		categories: categories.CATEGORY_KEYS.map((key) => ({ key, ...c.category[key] })),
		/* The miniature: which area, its reading off the basemap and the marks on it,
		   how wide each class of street is drawn, from the one table the area model and
		   the modelled map share, the height a building stands at when the tile gives
		   none, and the four things the app's model says about where its geometry came
		   from. */
		model: {
			name: modelName,
			city: modelHex.city,
			area,
			marks,
			roadWidth: basemap.ROAD_WIDTH,
			defaultHeight: basemap.DEFAULT_HEIGHT,
			states: c.app.model
		},
		stages: c.ai.stage,
		plans: plans.PLAN_KEYS.map((key) => ({ key, ...c.account.plan[key], ...plans.PLANS[key] })),
		greeting: c.tapak.greet(meta.hexes, 'pagi', 0),
		launch: {
			title: c.app.launchTitle,
			salute: c.greeting.pagi[0],
			suggestions: c.app.launchSuggestions,
			stats: c.app.launchStats,
			skip: c.app.launchSkip
		},
		tapakCopy: {
			budgetTight: c.tapak.budgetTight,
			budgetLoose: c.tapak.budgetLoose,
			why: c.tapak.why(top.name),
			avoid: c.tapak.avoid,
			ask: c.app.ask,
			caught: c.ai.caught,
			askAbout: c.tapak.askAbout
		},
		copy: {
			stage: c.stage,
			problem: c.problem,
			how: c.how,
			data: c.data,
			model: c.model,
			ai: c.ai,
			closing: c.closing,
			footer: c.footer,
			typology: c.typology,
			audience: c.audience,
			stats: c.stats,
			scale: c.scale,
			mood: { tiles: c.mood.tiles, transit: c.mood.transit, standingNote: c.mood.standingNote },
			property: { title: c.property.title, saleNote: c.property.saleNote, perM2: c.property.perM2 },
			activity: { title: c.activity.title },
			field: { title: c.field.title, notCensus: c.field.notCensus },
			breakdown: { title: c.breakdown.title, lead: c.breakdown.lead, transitLead: c.breakdown.transitLead }
		},
		demo,
		example,
		maps
	};

	const assets = {
		css: readFileSync(join(HERE, 'deck.css'), 'utf8'),
		albert: readFileSync(join(ROOT, 'static/fonts/albert-latin.woff2')).toString('base64'),
		inter: readFileSync(join(HERE, 'fonts/inter-latin.woff2')).toString('base64')
	};

	const html = renderDeck(facts, assets);
	lint(html);
	mkdirSync(HERE, { recursive: true });
	writeFileSync(OUT_HTML, html);
	console.log(`wrote ${OUT_HTML} (${Math.round(html.length / 1024)} KB)`);

	const browser = findBrowser();
	if (!browser) {
		console.log('no Chromium found: set CHROMIUM_BIN to print the PDF');
	} else {
		execFileSync(
			browser,
			[
				'--headless=new',
				'--no-sandbox',
				'--disable-gpu',
				'--hide-scrollbars',
				'--no-pdf-header-footer',
				'--virtual-time-budget=10000',
				`--print-to-pdf=${OUT_PDF}`,
				pathToFileURL(OUT_HTML).href
			],
			{ stdio: ['ignore', 'ignore', 'ignore'], timeout: 180_000 }
		);
		console.log(`wrote ${OUT_PDF}`);
	}
}

/**
 * The writing rules, applied to the deck the way they apply to the product: no em
 * dash and no semicolon in anything a reader sees. Checked on the text with the
 * markup stripped, since the stylesheet and the SVG paths are full of both.
 */
function lint(html) {
	const text = html
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<svg[\s\S]*?<\/svg>/g, '')
		.replace(/<[^>]+>/g, ' ')
		// An entity ends in a semicolon of its own, and that one is markup, not copy.
		.replace(/&[a-z#0-9]+;/gi, ' ');
	for (const [bad, name] of [
		['—', 'an em dash'],
		['–', 'an en dash'],
		[';', 'a semicolon']
	]) {
		const at = text.indexOf(bad);
		if (at >= 0) throw new Error(`${name} in slide copy near: ${text.slice(Math.max(0, at - 60), at + 20)}`);
	}
}

function findBrowser() {
	const candidates = [
		process.env.CHROMIUM_BIN,
		process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'),
		'/opt/pw-browsers/chromium',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser',
		'/usr/bin/google-chrome',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
	].filter(Boolean);
	return candidates.find((p) => existsSync(p)) ?? null;
}
