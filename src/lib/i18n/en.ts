import type { Copy } from './id';

/**
 * English copy — written, not translated.
 *
 * Same voice as the Indonesian: someone who knows the area explaining it plainly.
 * Short sentences, ordinary words, no brochure adjectives. Where a phrase only
 * works in Indonesian it is replaced with one that does the same job in English
 * rather than carried across word for word.
 *
 * Product names stay as they are (Struk Go, Menu Go, Properti Go, MAPID), and so
 * do the two words this market actually uses in English — *site selection* and
 * *catchment*.
 */
export const en: Copy = {
	lang: { code: 'en', label: 'English', short: 'EN', switchTo: 'Switch to Indonesian' },

	brand: {
		name: 'SpotOn',
		tagline: "Don't guess where to open. Ask the map.",
		appTagline: 'Site selection around Jakarta transit',
		open: 'Open SpotOn'
	},

	category: {
		kopi: { name: 'Coffee shop', short: 'Coffee', many: 'coffee shops' },
		minuman: { name: 'Drinks & dessert', short: 'Drinks', many: 'drink shops' },
		roti: { name: 'Bakery', short: 'Bakery', many: 'bakeries' },
		warteg: { name: 'Warung & rice shop', short: 'Warteg', many: 'warungs' },
		cepatsaji: { name: 'Fast food outlet', short: 'Fast food', many: 'fast food outlets' },
		mie: { name: 'Noodles & meatballs', short: 'Noodles', many: 'noodle shops' },
		seafood: { name: 'Seafood restaurant', short: 'Seafood', many: 'seafood restaurants' },
		restoasing: { name: 'Foreign cuisine restaurant', short: 'Foreign', many: 'foreign restaurants' },
		minimarket: { name: 'Minimarket', short: 'Minimarket', many: 'minimarkets' },
		kelontong: { name: 'Grocery store', short: 'Grocery', many: 'grocery stores' },
		laundry: { name: 'Laundry', short: 'Laundry', many: 'laundries' },
		bengkel: { name: 'Repair shop', short: 'Repair', many: 'repair shops' },
		apotek: { name: 'Pharmacy', short: 'Pharmacy', many: 'pharmacies' }
	},

	nav: {
		sections: [
			{ href: '#masalah', label: 'Problem' },
			{ href: '#cara-kerja', label: 'How it works' },
			{ href: '#ai', label: 'AI' },
			{ href: '#data', label: 'Data' }
		],
		aria: 'Page sections'
	},

	theme: { system: 'Match system', light: 'Light', dark: 'Dark' },

	stage: {
		/**
		 * The headline names the product rather than reaching for a metaphor.
		 *
		 * What used to sit here was "Walk the street first. Then sign." — a figure of
		 * speech that only lands if the reader ALREADY knows this is about renting a
		 * shop, which is precisely what they do not know yet at this line. The body
		 * only described the model, so someone arriving here could finish a whole
		 * screen without learning what SpotOn is.
		 *
		 * Now: one line stating the job, then a body tying the scene behind it back
		 * to that job.
		 */
		heroTitle: "Don't guess where to open.\nAsk the map.",
		heroBody:
			'SpotOn reads footfall, competitors and rentable space across every transit area in Jakarta, then tells you where to open and why. The figures on this page are still samples.',
		heroHint: 'scroll to watch a full day',
		dayTitle: 'How busy it is changes by the hour.',
		dayBody:
			'A pavement that is empty at 10am can be full at 7pm. You pay rent for all 24 hours, so which hours are busy decides what kind of business belongs there.',
		lotTitle: 'That outlined plot is still empty.',
		lotBody:
			'The see-through box above it is not a building that exists. It is the business you could open there. Demand is worth nothing if there is no space you can actually rent, so we treat available space as a requirement, not a bonus.',
		lotProv: 'Struk Go, Menu Go, Properti Go: sample · Stops & competitors: OSM',
		sample: 'sample data',
		reading: (struk: string, persen: number) => `${struk} receipts · ${persen}% of peak hour`,
		noReading: 'no transactions at this hour',
		sceneLabel: (nama: string, jam: string, struk: string) =>
			`A street block near ${nama} at ${jam}. Pedestrian density follows this cell's 24-hour transaction profile: ${struk} receipts in that hour.`
	},

	phase: {
		night: 'night',
		dawn: 'before dawn',
		morning: 'morning',
		midday: 'midday',
		afternoon: 'afternoon',
		dusk: 'dusk'
	},

	stats: {
		hexes: { label: 'cells scored', sub: (r: number) => `H3 hexagons, ${r} m walk` },
		stops: { label: 'transit stops mapped', sub: 'MRT, KRL, LRT, TransJakarta' },
		pois: { label: 'competitors mapped', sub: 'OpenStreetMap (ODbL)' },
		cats: {
			label: 'business types scored',
			sub: 'coffee, drinks, bakery, warteg, fast food, noodles, seafood, foreign, minimarket, grocery, laundry, repair, pharmacy'
		},
		coverNote: (terdata: string, total: string, nodata: string) =>
			`${terdata} of ${total} cells have data. The other ${nodata} are marked as not surveyed yet: we don't guess them, and we don't score them.`
	},

	problem: {
		mark: 'Problem',
		title: 'Three things decide whether a location works. Until now nobody looked at all three together.',
		rows: [
			{
				t: 'Nobody knows the demand',
				d: 'What people spend around a station is recorded in millions of receipts, but never collected by location. So nobody knows which areas are actually short of a particular kind of business.'
			},
			{
				t: 'The competition is not mapped',
				d: 'Opening a coffee shop where coffee shops are already stacked on top of each other is a way to lose money. But no map shows where similar businesses cluster, or how busy they are.'
			},
			{
				t: 'The space itself is never counted',
				d: 'An opportunity only matters if there is somewhere to put it. Yet shophouses, kiosks and units for rent are never tied back to footfall or to how many rivals sit next door.'
			}
		],
		statement:
			'The blocks around stations are the busiest trading ground in Jakarta. People still pick a location on instinct, and when they get it wrong it is their capital that burns.',
		chartTitle: 'You pay rent for 24 hours. It is not busy for 24 hours.',
		chartBody:
			'A pavement that is empty at 10am can be full at 7pm. This is the profile driving the model above, and the one the map reads inside the app.'
	},

	how: {
		mark: 'How it works',
		title: 'From raw data to one number you can defend.',
		steps: [
			{
				t: 'Cells one walk wide',
				d: (radius: number, hexes: string) =>
					`We cover Jakarta with a hexagonal grid. Only cells with a transit stop within ${radius === 800 ? 'an' : 'a'} ${radius} m walk get scored, which comes to ${hexes}. The grid exists so overlapping catchments don't count the same shoppers twice.`
			},
			{
				t: 'Three sources joined',
				d: 'Spending data, competitor data and listings data are matched to the cell they fall in. That leaves three numbers per cell: how much is spent, how busy the rivals are, and whether there is anywhere to rent.'
			},
			{
				t: 'An opportunity score per business type',
				d: 'The gap between what is spent and what is already served is worked out for each business type. Busy competitors count for more, and the result then has to clear one requirement: rentable space.'
			},
			{
				t: 'A ranking, with the reasons attached',
				d: 'Cells are ranked per business type and labelled: still underserved, competitive, saturated, or busy but hard to find space in.'
			}
		],
		plain:
			'Opportunity = how much money gets spent there, minus how busy the similar businesses are. Then one requirement: there has to be space you can actually rent.',
		note:
			"Competitors are not just counted. The shop next door that is always full pushes your opportunity down much harder than the one sitting empty, so the two don't count the same. And however good the number looks, an opportunity you cannot occupy cannot be acted on, which is why available space is a requirement rather than a bonus. You can move the weight between demand and competition yourself.",
		scaleCap: 'The result is one scale, and it is also the map legend',
		formulaSummary: 'The exact formula'
	},

	signal: {
		demand: { nm: 'Demand', src: 'Struk Go', d: 'How much money people spend there.' },
		supply: {
			nm: 'Competition',
			src: 'Menu Go',
			d: 'Not just how many. The ones that are always full push harder.'
		},
		gate: {
			nm: 'Rentable space',
			src: 'Properti Go',
			ok: 'space available → opportunity stands',
			no: 'none available → opportunity near zero',
			d: 'A requirement, not a bonus. An opportunity you cannot occupy is not one.'
		}
	},

	grid: {
		mark: 'schematic, not a specific area',
		caption: {
			lead: 'One hexagon, one cell.',
			strong: 'Height and colour both carry the opportunity score',
			rest: ', on the same scale the map uses inside the app. The sunken, colourless ones have no data yet. The dashed circle is the walking distance used when the grid was built.'
		},
		outOfScale: 'no data yet, outside the scale',
		label:
			'A model of the hexagonal grid. Each cell is one hexagon, and both its height and its colour represent the opportunity score on the same scale as the map. Cells without data are left sunken and colourless. The dashed circle marks the walking distance from the cell being measured.'
	},

	ai: {
		mark: 'Ask the map',
		title: 'Ask the map in plain language.',
		p1: 'No formula to fill in and no jargon to memorise. Tapak starts the conversation: it asks first, offers answers you can just tap, then replies with a list of places and the reasons behind them.',
		p2: 'Before answering, the map shows what it understood from your question. If it picked something up wrong, you see it immediately. Every answer says why, and how much data it rests on.',
		p3: 'The conversation beside this runs on its own. We wrote the questions, but not the numbers: every name and every value there is computed by the same scoring engine the map uses. Tap a business type to jump to another conversation.',
		caught: 'What the map understood',
		thinking: 'One moment, let me check my notes…',
		more: (n: number) => `+${n} more in the app`,
		play: 'Play conversation',
		pause: 'Pause conversation',
		foot: 'The questions are samples, but the answers come from the same scoring engine as the app.',
		footMock: 'mission attributes are still sample data.'
	},

	data: {
		mark: 'Data',
		title: 'Areas we have no data for are shown as exactly that.',
		body: "When an area has no data, we don't invent a number to stand in for it. It is marked empty and goes into the queue to be surveyed first. Every figure also says how many data points sit behind it, so you can judge for yourself how solid the ground is.",
		gridWithData: 'cells have data',
		gridEmpty: 'no data yet, not scored, queued for survey',
		gridLabel: (total: number, terdata: number, nodata: number) =>
			`A grid of ${total} cells: ${terdata} have data, ${nodata} do not.`,
		realTitle: 'What is real',
		realUnit: (stops: string) =>
			`${stops} transit stops across four modes, with their route geometry, from OpenStreetMap via the Overpass API (ODbL). Each cell's transit access is computed from this.`,
		poiTitle: 'Competitors mapped, by business type',
		poiUnit: (pois: string) =>
			`${pois} similar businesses, also from OpenStreetMap. This is the competitor count the scoring engine uses, not an estimate.`,
		mockTitle: 'What is still sample data',
		mockNote:
			'The attributes specific to the MAPID mission dataset (Struk Go, Menu Go, Properti Go, including the 24-hour profile and the number of units for rent) are still samples, because the data has only been opened to 50 selected teams. The structure already follows the real columns and all data access goes through a single module, so swapping in the MAPID API will not touch any interface code. Until then, the MOCK marker follows those numbers wherever they appear.'
	},

	hourChart: {
		caption: 'Transactions per hour, across every area with data.',
		table: 'The hourly figures',
		colHour: 'Hour',
		colValue: 'Receipts',
		tableCaption: 'Receipts per hour',
		peak: 'peak',
		unit: 'receipts',
		unitApp: 'transactions',
		label: (total: string, jam: string, puncak: string, unit: string) =>
			`24-hour profile: ${total} ${unit} in total, busiest at ${jam} with ${puncak} ${unit}.`,
		bar: (jam: string, nilai: string, unit: string) => `At ${jam}: ${nilai} ${unit}`
	},

	scale: { low: '0 · low', high: '100 · high', nodata: 'no data yet, left unscored' },

	audience: {
		mark: 'Who it is for',
		title: 'One map, thirteen kinds of decision.',
		rows: [
			{ t: 'Retail & F&B investors', d: 'Pick the next branch from data instead of instinct.' },
			{ t: 'Small businesses on a tight budget', d: 'Find a good location where the rent still makes sense.' },
			{
				t: 'First-time owners',
				d: '“What kind of business makes sense around here?” Answered, with the reasoning.'
			},
			{ t: 'Expansion teams', d: 'Shortlist and rank candidate sites along the transit corridors.' },
			{ t: 'Property owners & agents', d: 'Know what a unit suits, and who the right tenant is.' }
		]
	},

	closing: {
		title: 'A map that answers, not one that just displays.',
		cta: 'Open SpotOn',
		ghost: 'See how it works'
	},

	footer: {
		desc: 'An AI-assisted WebGIS for retail and F&B site selection around Jakarta transit.',
		teamLabel: 'Team Triple T',
		team: 'Valent Nathanael · Farhan Aulianda · Anthony Gilles Rudolfo',
		campus: 'Bina Nusantara University',
		dataLabel: 'Data',
		dataNote:
			'Geometry and POIs © OpenStreetMap contributors (ODbL). MAPID mission attributes are still samples. Required basemap for the final product: MAPID MAPS.'
	},

	meta: {
		title: "SpotOn · Don't guess where to open. Ask the map.",
		description:
			'SpotOn brings together demand, competition and available space for every walkable catchment around Jakarta transit, then shows where to open a business and why.',
		appTitle: 'SpotOn · Site selection map for Jakarta transit areas'
	},

	typology: {
		underserved: 'Underserved',
		competitive: 'Competitive',
		saturated: 'Saturated',
		'busy-limited-space': 'Busy, little space',
		'no-data': 'No data yet',
		'not-covered': 'Not yet surveyed'
	},

	supply: {
		denseBusy: 'they sit close together and most are busy, so the gap is narrow',
		denseQuiet: 'they sit close together but most are quiet, which reads as saturation',
		fewBusy: 'there are few of them but most are busy, so demand looks pent up',
		fewQuiet: 'there are few of them and most are quiet'
	},

	detail: {
		empty: 'Pick a cell on the map or in the table to see its demand, competition and available space.',
		catchment: (r: number) => `${r} m catchment`,
		nodata: (osm: number, cat: string, r: number) =>
			`No MAPID mission data for this cell yet (N = 0). There are no Struk Go, Menu Go or Properti Go points inside it, so we leave the score blank. It goes on the survey priority list. No data does not mean no business: OSM records ${osm} ${cat} within ${r} m.`,
		score: (cat: string) => `${cat} score`,
		demand: 'Demand',
		nStruk: (n: number) => `N receipts = ${n}`,
		rivals: 'Competitors',
		supplyEff: 'Effective supply',
		busyPct: (p: string) => `${p}% busy`,
		space: 'Rentable space',
		listingOf: (n: number) => `listings out of ${n}`,
		cashless: 'Cashless',
		cashlessSub: 'proxy for spending power',
		hourTitle: (n: number) => `Transactions per hour · Struk Go · N = ${n}`,
		acrossTitle: 'Opportunity by business type, at the current weights',
		summaryLead: 'Summary.',
		summary: (jam: string, cat: string, osm: number, r: number, frasa: string, listing: number, kat: string) =>
			`This cell is busiest at ${jam}. For ${cat}, OSM records ${osm} competitors within ${r} m, and ${frasa}. There are ${listing} listings in the ${kat} category.`,
		summaryNote:
			'Competitor counts come from OSM (real), while MAPID mission attributes are still samples. N is shown so it can be checked.'
	},

	/* ── Score composition ─────────────────────────────────────────────────
	   The panel that answers "why this number?". The order is deliberate: the
	   transit nodes lead — the one input built from real data, and the point of
	   this project — and the step-by-step arithmetic follows. */
	breakdown: {
		title: 'How this score is made',
		lead: 'The score above is built in order. Every step can be traced back to its data.',
		/* A cell the competitor source has not surveyed has no score to take apart.
		   What follows still holds: its transit nodes come from OSM, are real, and do
		   not disappear because a category has not been surveyed here. */
		noScore:
			'This cell cannot be scored for the business type currently selected, so there are no steps to show. Its transit access is real and recorded all the same.',
		transitLead: 'What decides it most: mass transit',
		stopsUnit: (n: number) => (n === 1 ? 'transit node in range' : 'transit nodes in range'),
		stopsSub: (r: number) => `within a ${r} m walk of the cell centre · OSM, real data`,
		stopsSplit: (rel: number, halte: number) => {
			if (rel > 0 && halte > 0) return `${rel} rail stations · ${halte} TransJakarta stops`;
			if (rel > 0) return `${rel} rail ${rel === 1 ? 'station' : 'stations'}`;
			return `${halte} TransJakarta ${halte === 1 ? 'stop' : 'stops'}`;
		},
		none: 'This cell catches no transit node at all within walking range.',
		contributes: (poin: number, total: number) =>
			`Of this cell's ${total} points, ${poin} come from its transit access.`,
		without: (poin: number) => `With no transit at all it would score ${poin}.`,
		ceiling: (poin: number) =>
			`Transit access can add at most ${poin} points to this cell. The rest is already settled by demand and competition.`,
		splitBase: 'demand − competition',
		splitTransit: 'transit access',
		splitAria: (dasar: number, transit: number, total: number) =>
			`${total} points: ${dasar} from demand and competition, ${transit} from transit access.`,

		stepsTitle: 'Step by step',
		rows: {
			start: 'Level footing',
			demand: 'Demand',
			supply: 'Competition',
			clamp: 'Kept in range',
			gate: 'Space requirement',
			access: 'Transit access'
		},
		notes: {
			start: 'before any data is read, every cell starts here',
			demand: (bobot: number, nilai: number) => `weight ${bobot.toFixed(2)} × demand ${nilai}`,
			supply: (bobot: number, nilai: number) =>
				`weight ${bobot.toFixed(2)} × effective supply ${nilai}`,
			clamp: 'the result is not allowed outside 0–100',
			gateOff: 'the requirement is switched off',
			gatePass: (n: number) => `${n} ${n === 1 ? 'unit' : 'units'} up for rent, requirement met`,
			gateBlock: (f: number) => `nothing up for rent → ×${f.toFixed(2)}`,
			access: (pengali: number, akses: number) =>
				`×${pengali.toFixed(2)} = 0.60 + 0.40 × access index ${akses.toFixed(2)}`
		},
		total: 'Opportunity score',
		deltaAria: (poin: number) =>
			poin >= 0 ? `up ${poin} points` : `down ${Math.abs(poin)} points`,

		accessTitle: 'What the access index is made of',
		accessRow: (n: number, bobot: number) =>
			`${n} ${n === 1 ? 'node' : 'nodes'} × weight ${bobot.toFixed(2)}`,
		accessShare: (persen: number) => `${persen}% of the index`,
		accessIndex: (akses: number, pengali: number) =>
			`Access index ${akses.toFixed(2)} → score multiplier ${pengali.toFixed(2)}`,
		accessFormula: (pembagi: number) =>
			`Access index = √(Σ nodes × their mode weight) ÷ ${pembagi.toFixed(1)}, capped at 1. Computed once when the grid was built, from OSM. The weights differ because the modes carry different numbers of people.`,

		stationsTitle: 'The nodes in range, one by one',
		stationsLoading: 'Loading the list of nodes…',
		stationsFailed:
			'The list of node names could not be loaded. The counts and the access index above still hold, both are read from the grid, not from that file.',
		modeGroup: (moda: string, n: number) => `${moda} · ${n} ${n === 1 ? 'node' : 'nodes'}`,
		unnamed: (n: number) =>
			`+${n} more with no name of their own: platforms of the same station, or stops OSM has not named`
	},

	table: {
		cols: {
			name: 'Cell',
			score: 'Score',
			demand: 'Demand',
			supply: 'Supply',
			osm: 'Competitors (OSM)',
			listings: 'Listings',
			nTot: 'N mission',
			typology: 'Type'
		},
		empty: 'No cells to show.'
	},

	control: {
		weights: 'Opportunity weights',
		demand: 'Demand',
		demandHint: 'Struk Go: transaction counts, what is bought, busy hours, and the cashless share.',
		supply: 'Competition',
		supplyHint: 'Menu Go: competitor density weighted by how busy they are. Busy rivals push harder.',
		gate: 'Space requirement',
		gateLabel: 'Require a listing',
		gateSub: 'With nowhere to occupy, the opportunity cannot be acted on.',
		walk: 'Walking distance',
		walkNote: (r: number) =>
			`Fixed at ${r} m, about a 10-minute walk. It was applied when the grid was built, to compute transit access and competitors per cell.`,
		layers: 'Layers',
		layerNames: {
			score: 'Opportunity score',
			routes: 'Transit lines',
			poi: 'Competitor scatter',
			nodata: 'Cells with no data',
			label: 'Stop names',
			stops: 'Transit nodes of the selected cell'
		},
		legend: 'Legend',
		legendLow: 'Low',
		legendHigh: 'High',
		keyNodata: 'No data yet (N = 0)',
		keySaturated: 'Flagged saturated',
		keyDot: 'Transit stop, click for detail',
		honesty: 'Data honesty',
		honesty1: (terdata: number, total: number, titik: number) =>
			`${terdata} of ${total} cells have mission data (${titik} sample points).`,
		honesty2: (poi: number, r: number) => `${poi} competitor POIs counted from OSM within ${r} m.`,
		honesty3:
			'Cells without data are not interpolated. They are hatched and put on the survey priority list. Every score carries its N in the panel and the table, so you can judge how solid the ground is.',
		prov: 'Sources',
		provReal:
			'Transit stops across four modes (MRT, KRL, LRT, TransJakarta), their route geometry, and competitor POI counts per radius, from the Overpass API (ODbL).',
		provMock:
			'Attributes specific to the MAPID mission dataset (Struk Go, Menu Go, Properti Go), because the data is not public yet. The structure follows the real columns, so it can be swapped in as soon as the MAPID API is available.',
		provBasemap: 'Required basemap for the final product: MAPID MAPS.'
	},

	mood: {
		busiest: 'at its busiest',
		busy: 'fairly busy',
		quiet: 'a bit quiet',
		empty: 'quiet',
		nodata:
			'This cell has no data yet, so the street is deliberately left empty. That does not mean it is actually deserted.',
		reading: (jam: string, kata: string) => `At ${jam} this place is ${kata}.`,
		peakAt: (jam: string) => `Busiest around ${jam}.`,
		rivals: (n: number, cat: string) => `There are ${n} other ${cat} nearby`,
		listings: (n: number) => `and ${n} units up for rent.`,
		noListings: 'and nothing up for rent.',
		rows: {
			score: 'Opportunity score',
			demand: 'Demand',
			supply: 'Effective supply',
			now: 'Transactions this hour',
			peak: 'Daily peak',
			rivals: 'Competitors (OSM)',
			busy: 'Busy competitors',
			space: 'Units for rent',
			points: 'Data points'
		},
		/* ── Transit access ─────────────────────────────────────────────────
		   Written for a reader who does not read index numbers. The station names
		   lead: "Blok M" can be pictured, checked and argued with; "access 0.82"
		   can do none of those. The figure is still there, behind the name. */
		transit: 'What this area reaches',
		/* The count leads rather than being tucked into a sentence. This is the mass
		   transit edition: how many nodes one cell reaches is the first question, so
		   the answer is set large before anything else. */
		transitCount: (n: number) =>
			n === 1 ? 'transit node within walking range' : 'transit nodes within walking range',
		transitCountSplit: (rel: number, halte: number) => {
			if (rel > 0 && halte > 0) return `${rel} rail stations · ${halte} TransJakarta stops`;
			if (rel > 0) return `${rel} rail ${rel === 1 ? 'station' : 'stations'}`;
			return `${halte} TransJakarta ${halte === 1 ? 'stop' : 'stops'}`;
		},
		transitNone: 'No transit node within walking range of this cell.',
		transitLoading: 'Checking the transit nodes nearby…',
		transitBand: {
			strongest: 'Transit access here is among the strongest in Jakarta.',
			strong: 'Transit access here is strong.',
			fair: 'Transit access here is fair.',
			thin: 'Transit access here is thin.'
		},
		transitModes: {
			mrt: 'MRT',
			krl: 'KRL',
			lrt: 'LRT',
			brt: 'TransJakarta'
		},
		transitModeLong: {
			mrt: 'MRT stations',
			krl: 'KRL stations',
			lrt: 'LRT stations',
			brt: 'TransJakarta stops'
		},
		/* Rail and bus are kept apart because the difference is real for someone
		   opening a business: a rail station is one fixed doorway busy all day,
		   while bus stops are many and spread out, so their crowd is divided. */
		transitRail: 'Rail stations in range',
		transitBus: (n: number) => `${n} TransJakarta stops within walking range`,
		transitWalk: (m: number) => `${m} m`,
		transitUplift: (persen: number) =>
			`This access lifts the cell's opportunity score by roughly ${persen}% against a cell with no transit at all.`,
		transitWhyRail:
			'A rail station moves the same people past you at the same hours every working day. That is flow you can plan around, not passing traffic.',
		transitWhyBus:
			'TransJakarta stops are spread out, so the crowd is divided between many of them. Good for reach, not for one busy doorway.',
		transitRadius: (m: number) => `Measured from the cell centre, ${m} m radius`,
		transitShow: 'Show on map',
		transitHide: 'Hide from map',
		prov: 'Transactions & space: MAPID sample data. Competitors & stops: OSM.',
		sceneLabel: (nama: string, jam: string, isi: string) => `Schematic of ${nama} at ${jam}. ${isi}`,
		sceneNodata: 'There is no data for this area yet, so the street is shown empty.',
		sceneBody: (n: number, osm: number, cat: string, listing: number) =>
			`Around ${n} transactions this hour, ${osm} competing ${cat}, and ${listing} units up for rent.`
	},

	/* ── app ──────────────────────────────────────────────────────────────── */

	app: {
		categoryLabel: 'Business type',
		coverage: (terdata: number, total: number, poi: number) =>
			`${terdata}/${total} cells · ${poi} competitors mapped`,
		/* The competitor count only exists once a category's columns are loaded. Until
		   then the sentence stops at the cells — writing "0 competitors mapped" claims
		   to have counted and found nobody, when nothing has been counted at all. */
		coverageCells: (terdata: number, total: number) => `${terdata}/${total} cells`,
		coverageTitle: 'Cells that have data, and the number of similar businesses recorded in OpenStreetMap',
		advanced: 'Advanced settings',
		advancedClose: 'Close settings',
		tapak: 'Tapak',
		tapakSub: ', your guide',
		mood: 'What the area feels like',
		numbers: 'Full figures for this area',
		table: 'Attribute table',
		tableHide: 'Hide attribute table',
		tableHint: ', click a column heading to sort',
		panel: 'Panel',
		tabs: { recommendations: 'Tapak', detail: 'Area', table: 'Table', controls: 'Advanced' },
		loadingMap: 'Loading map…',
		zoomIn: 'Zoom in',
		zoomOut: 'Zoom out',
		reset: 'Reset the view',
		legendUnit: 'opportunity score',
		sourceLabel: 'Competitor data source',
		sourceOsm: 'OpenStreetMap: even coverage, volunteered',
		sourceMapid: 'MAPID: surveyed, all 5 Jakarta cities',
		legendUncovered: (n: number, cat: string, src: string) =>
			`${n} cells are not covered by ${src} data for ${cat}, so they are unscored. That is not the same as having no competitors`,
		legendUncoveredAll: (cat: string, src: string, other: string) =>
			`${src} has no competitor data for ${cat}, so nothing can be scored. Try the ${other} source.`,
		legendNodata: (n: number) => `${n} cells have no data, left unscored`,
		/* The heatmap states an opinion — which cells are good for one kind of business.
		   It appears when it is actually asked for: by this button, or by Tapak
		   answering a question. */
		heatmapShow: 'Show heatmap',
		heatmapHide: 'Hide heatmap',
		heatmapLoading: 'Loading category data…',
		heatmapHint: (cat: string) => `Colour the cells by ${cat} opportunity score`,
		heatmapAria: 'Opportunity score heatmap',
		/* The map tooltip before any category is loaded: the cell is named, and nothing
		   more is claimed. */
		tipNoCategory: 'Turn the heatmap on to see its score',
		needCategory: 'No category loaded yet. Turn the heatmap on, or ask Tapak.',
		ask: 'Or ask your own…',
		askAria: 'Ask Tapak',
		askSend: 'Ask',
		/* The opening question box, centred on screen. The heading is a question, not
		   a slogan: answering it is exactly what the user is being asked to do. */
		launchTitle: 'What do you want to open?',
		/**
		 * Example questions, doing two jobs at once.
		 *
		 * `ask` is what types itself inside the field, and also what actually gets
		 * sent. `short` is what the button says. Two forms, one list, so a button can
		 * never promise a different question from the one it sends.
		 *
		 * The self-typing example teaches the SHAPE of a question; the buttons give a
		 * one-tap way in. The button labels are deliberately short: a full sentence on
		 * a pill widens the row until it stops reading as a suggestion.
		 *
		 * Every example has to be genuinely answerable, and the answer has to be worth
		 * having. Two look for a location, one flags crowded areas, one compares two
		 * places. Any area named must exist in the grid, or the comparison falls
		 * through to "name two areas" and the suggestion becomes a trap.
		 */
		launchSuggestions: [
			{
				short: 'Coffee shop, cheap rent',
				ask: 'Where should I open a coffee shop with cheap rent near the MRT?'
			},
			/* A pill label has to stand on its own, with no preceding sentence to lean
			   on, so each one names its subject. "Already saturated" and "No data yet"
			   named neither what was saturated nor what was missing data. Inside the
			   conversation that is fine, because an answer sits above them. Here there
			   is nothing above them at all. */
			{ short: 'Areas to avoid', ask: 'Which areas are already saturated for minimarkets?' },
			{ short: 'Compare two areas', ask: 'Compare Balai Kota and Manggarai for a pharmacy' },
			/* This slot used to hold "Which areas have no data yet?". The question is
			   answerable, but the answer is a list of areas that are deliberately NOT
			   scored, and nobody opens SpotOn for that. As an opening suggestion it
			   spent one of only four places. The coverage question still lives inside
			   the conversation, which is where it belongs: after an answer worth
			   questioning. */
			{ short: 'Best areas for a laundry', ask: 'Where should I open a laundry near a station?' }
		],
		/* The foot of the card: how thick the evidence is, in four figures. The labels
		   name the source, because a number with no origin is decoration. */
		launchStats: {
			hexes: 'cells scored',
			stops: 'transit stops',
			pois: 'businesses mapped',
			cats: 'business types'
		},
		/* The chips are framed as examples, not a menu. Without this label a row of
		   business-type buttons reads as "these are the only things you may ask". */
		closeArea: 'Close area',
		dismissRemark: "Dismiss Tapak's note",
		home: 'Back to the SpotOn home page',
		emptyMood: 'No area selected yet. Tap a cell on the map to see what it feels like.',
		pickBest: (cat: string) => `Pick the best one for a ${cat}`,
		clock: 'Hour',
		clockAria: 'Drag to see this area at another hour',
		schema: 'schematic, not an actual site plan',
		fullNumbers: 'See the full figures',
		/* The map's own badge, pinned to the selected cell. Deliberately the count and
		   nothing else: the breakdown is in the panel, what the map has to carry is
		   "how many". */
		mapStops: (n: number) => `${n} transit ${n === 1 ? 'node' : 'nodes'}`,
		mapStopsAria: (n: number, r: number) =>
			`${n} transit ${n === 1 ? 'node' : 'nodes'} within a ${r} m walk of this cell`,
		mapReach: (r: number) => `${r} m reach`,
		tipNodata: 'MAPID mission data: N = 0 · survey priority candidate',
		tipScore: (cat: string) => `${cat} score`,
		sheet: 'Information panel',
		sheetGrip: 'Resize panel'
	},

	tapak: {
		greet: (total: number, terdata: number) =>
			`Hello, I'm Tapak. I've been round ${total} cells near the MRT, KRL, LRT and TransJakarta corridors, and ${terdata} of them have data. What are you thinking of opening?`,
		/* This used to ask "How is the budget looking?" and offer "Tight" or
		   "Reasonably open" — two words that say nothing about what will change. The
		   only thing actually chosen here is whether the results are narrowed to
		   areas that genuinely have space up for rent, in the lower bracket. So that
		   is what gets asked, and that is what the buttons say. */
		budgetAsk: (cat: string) => `A ${cat}, alright. What about the rent?`,
		budgetTight: 'Only where the rent is cheap',
		budgetLoose: 'Any rent, just find a good area',
		prefaceTight:
			'Right. I will narrow it to areas that genuinely have space up for rent, in the lower bracket.',
		prefaceLoose: 'Right, I will look at every area, with no rent filter.',
		restart: 'What would you like to look at now?',
		tryOther: 'Try another business',
		avoid: 'Which ones should I avoid?',
		avoidQ: (cat: string) => `Which areas are saturated for a ${cat}?`,
		coverage: 'Which ones have no data?',
		coverageQ: 'Which areas have no data yet?',
		retry: 'Try again',
		failed: (err: string) => `Sorry, my notes wouldn't open just now. ${err} Want to ask again?`,
		nothing: "I haven't found anything for that."
	},

	narrate: {
		notUnderstood: (why: string) =>
			`${why} All I know is the areas around Jakarta transit, for thirteen kinds of business. Want me to look at one of those?`,
		coverageNone: 'Every area has data.',
		coverageSome: (n: number) =>
			`There are ${n} areas I have no data for at all. I'm not scoring them. Rather than make something up, I'd rather say I don't know.`,
		saturatedNone: 'Nothing is genuinely crowded for this business.',
		saturatedSome: (n: number, cat: string) =>
			`These ${n} areas are the ones to avoid for now for a ${cat}. The competitors sit close together and most of them are busy.`,
		compare: 'Side by side, here is how they compare.',
		rankNone: (cat: string) =>
			`Nothing fits a ${cat} under those conditions yet. Want me to loosen them?`,
		rankTop: (name: string, nilai: string | null, n: number) =>
			`If it were up to me, ${name} first${nilai ? `, scoring ${nilai} out of 100` : ''}. Here are the top ${n} from my notes.`,
		remarkNodata: (name: string, osm: number, cat: string) =>
			`${name} has no data yet, so I won't put a number on it. All I know is that open map data shows ${osm} ${cat} nearby.`,
		remark: (name: string, verdict: string, cat: string, nilai: string, osm: number, listing: string) =>
			`${name} is ${verdict} for a ${cat}, scoring ${nilai}. There are ${osm} similar businesses, and ${listing}.`,
		verdictGood: 'one of the good ones',
		verdictMid: 'middling',
		verdictLow: 'honestly not promising',
		listingSome: (n: number) => `${n} units up for rent`,
		listingNone: 'nothing up for rent'
	},

	query: {
		saturated: 'already crowded',
		coverage: 'with no data yet',
		within: (r: number) => `within ${r === 800 ? 'an' : 'a'} ${r} m walk of a transit stop`,
		hasSpace: 'has space for rent',
		cheap: 'lower rent bracket'
	},

	demo: {
		coverageAsk: 'Hold on, is the data complete?',
		coverageChip: 'Data coverage',
		coverageReply: "Not all of it. Want me to show you which ones are missing?",
		coverageYes: 'Show me',
		coveragePreface: 'These are the ones I have no data for.',
		saturatedChip: 'Saturated',
		saturatedAsk: 'Minimarket, alright. Shall I find the good ones, or the ones to avoid?',
		saturatedYes: 'The ones to avoid',
		saturatedPreface: 'Sure. These have the tightest competition.'
	}
};
