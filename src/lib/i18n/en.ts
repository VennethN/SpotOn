import type { Copy } from './id';
import { moneyScale } from '$lib/utils/format';

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

/**
 * Rupiah, written short: 45000000 → "Rp 45m", 4300000000 → "Rp 4.3bn".
 *
 * The suffixes are English, the thresholds are not: those come from `moneyScale`, so
 * the two languages cannot end up writing the same price as "Rp 950 jt" on one side and
 * "Rp 1.0bn" on the other. The currency stays "Rp" in both, because that is what is
 * written on the price.
 *
 * The rounding happens before the whole-number test, not after, so Rp 6.95bn and Rp 7bn
 * both come out "Rp 7bn". Testing first would set them in a column as "Rp 7.0bn" above
 * "Rp 7bn" and make one look more precisely known than the other. They are asking
 * prices, and neither is.
 */
const SCALE_EN = { unit: '', thousand: 'k', million: 'm', billion: 'bn' } as const;
const rp = (v: number): string => {
	const { value, scale } = moneyScale(v);
	const r = Math.round(value * 10) / 10;
	const n = Number.isInteger(r) ? r.toLocaleString('en-US') : r.toFixed(1);
	return `Rp ${n}${SCALE_EN[scale]}`;
};

/** English thousands: 7577 → "7,577". `format.num` is Indonesian on purpose and would
    print "7.577" here, which an English reader reads as seven and a half. */
const num = (v: number): string => v.toLocaleString('en-US');

/** A whole hour, English: 7 → "7am", 19 → "7pm". `format.formatHour` writes "07.00",
    which is the Indonesian convention and is why hours are written per locale. */
const hour = (h: number): string => {
	const clock = ((h % 24) + 24) % 24;
	const half = clock < 12 ? 'am' : 'pm';
	return `${clock % 12 === 0 ? 12 : clock % 12}${half}`;
};

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
		/* The order follows the page, and the page has been reordered: the data first,
		   then how it is turned into a score, then how to ask. Explaining a score before
		   the reader knows where its numbers come from is back to front. */
		sections: [
			{ href: '#masalah', label: 'Problem' },
			{ href: '#data', label: 'Data' },
			{ href: '#cara-kerja', label: 'How it works' },
			{ href: '#ai', label: 'Ask' }
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
			'SpotOn counts the businesses already standing, the competitors of your kind, the transit stops and the premises on the market across every transit area in Jakarta, then tells you where to open and why.',
		heroHint: 'scroll to walk one block',
		dayTitle: 'Busy is something you can count.',
		dayBody:
			'Not from a hunch, and not from a survey nobody has run. What is counted is the businesses already standing within walking range: if a block supports dozens of them, people plainly come past.',
		lotTitle: 'That outlined plot is still empty.',
		lotBody:
			'The see-through box above it is not a building that exists. It is the business you could open there. Demand is worth nothing if there is no space you can actually rent, so we treat available space as a requirement, not a bonus.',
		reading: (nama: string, n: number) => `${nama} · ${n} businesses within walking range`,
		sceneLabel: (nama: string, n: number, pesaing: number) =>
			`A street block in ${nama}. How busy it looks follows the businesses actually standing within walking range of that cell: ${n} of them, ${pesaing} of the same kind.`
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
		pois: { label: 'businesses mapped', sub: 'within walking range' },
		cats: {
			label: 'business types scored',
			sub: 'food, everyday retail, and services'
		}
	},

	problem: {
		mark: 'Problem',
		title: 'Pick the wrong spot and it is your capital that burns.',
		rows: [
			{
				t: 'Nobody counted how busy it is',
				d: 'Everyone knows the blocks around a station are busy. Nobody knows which blocks.'
			},
			{
				t: 'The competition is invisible',
				d: 'Opening a coffee shop on a street already full of them is a way to lose money.'
			},
			{
				t: 'The space is never counted',
				d: 'A good area with nothing to rent is not an opportunity.'
			}
		],
		statement:
			'The blocks around stations are the busiest trading ground in Jakarta, and people still pick a location on instinct.',
		chartTitle: 'Busy is not spread evenly.',
		chartBody:
			'Each bar: how many cells hold that many businesses within walking range. Most are quiet, a few are dense.'
	},

	how: {
		mark: 'How it works',
		title: 'One score per cell, per business type.',
		steps: [
			{
				t: 'Cells one walk wide',
				d: (radius: number, hexes: string) =>
					`Jakarta is covered with a hexagonal grid. Only the ${hexes} cells with a transit stop within ${radius} m get scored.`
			},
			{
				t: 'Three sources joined',
				d: 'Business points, transit stops and premises on the market, each matched to the cell it falls in.'
			},
			{
				t: 'Worked out per business type',
				d: 'Busy minus rivals of your kind, then multiplied by transit access and the price of space.'
			},
			{
				t: 'Ranked, with the reasons',
				d: 'Every cell gets a label: underserved, competitive, or saturated.'
			}
		],
		plain: 'Find an area that is busy, still thin on your kind of rival, and has somewhere to rent.'
	},


	grid: {
		mark: 'schematic, not a specific area',
		caption: {
			lead: 'One hexagon, one cell.',
			strong: 'Height and colour both carry the opportunity score',
			rest: ", sampled from the grid's own real scores, on the same scale the map uses inside the app. The sunken, colourless ones sit in a city nobody has surveyed. The dashed circle is the walking distance used when the grid was built."
		},
		outOfScale: 'not surveyed, outside the scale',
		label:
			'A model of the hexagonal grid. Height and colour are real opportunity scores, sampled evenly across the whole grid, on the same scale as the map. Only the arrangement is schematic: the tallest are placed in the middle. Cells whose city has not been surveyed are left sunken and colourless.'
	},

	ai: {
		mark: 'Ask the map',
		title: 'Ask in plain language, and the map changes.',
		p1: 'Say what you want to open and the whole city recolours for that business. No formula to fill in and no jargon to memorise.',
		p2: 'Before answering, the map shows what it understood. If it picked something up wrong, you see it immediately.',
		p3: 'The questions are samples. The numbers are not: every colour and value here comes from the same engine the app runs.',
		mapEmpty: 'Map of 562 catchments around Jakarta transit, waiting for the first question.',
		mapLabel: (kind: string) =>
			`Map of 562 catchments around Jakarta transit, coloured by opportunity score for ${kind}.`,
		mapCaption: (kind: string) => `Opportunity score for ${kind}, 562 catchments, computed just now.`,
		caught: 'What the map understood',
		thinking: 'One moment, let me check my notes',
		stage: {
			reading: 'One moment, I am reading your question',
			retrying: 'No answer from that one, trying another',
			choosing: 'I have it, working out what to look up',
			computing: 'Now counting it up from my notes'
		},
		more: (n: number) => `+${n} more in the app`,
		play: 'Play conversation',
		pause: 'Pause conversation'
	},

	data: {
		mark: 'Data',
		title: 'Every cell is counted on its own.',
		body: 'The businesses already standing, the transit stops, and the premises on the market. Counted one by one in each cell, not inferred from a city average.',
		gridWithData: 'cells with data',
		gridEmpty: 'no data yet',
		gridLabel: (total: number, terdata: number, nodata: number) =>
			`A grid of ${total} cells: ${terdata} sit in a surveyed city, ${nodata} do not.`
	},

	spreadChart: {
		caption: 'Cells by how many businesses stand within walking range.',
		table: 'The figures per band',
		colBand: 'Up to',
		colValue: 'Cells',
		tableCaption: 'Cells per business-density band',
		axisUnit: 'businesses',
		unit: 'cells',
		upTo: (batas: string) => `up to ${batas} businesses`,
		label: (total: string, batas: string, puncak: string, unit: string) =>
			`A spread of ${total} ${unit}, fullest in the band up to ${batas} businesses with ${puncak} ${unit}.`,
		bar: (batas: string, nilai: string, unit: string) => `Up to ${batas} businesses: ${nilai} ${unit}`
	},

	scale: { low: '0 · low', high: '100 · high', nodata: 'not surveyed, left unscored' },

	/* Names alone, with no sentence under each. Every row used to carry one, and the
	   sentence was padding around the only part that mattered, which was the name. */
	audience: {
		mark: 'Who it is for',
		/* Not capped at thirteen. It is thirteen today, and putting the number in the
		   heading makes it read as a limit when it is only the count of what has been
		   added so far. */
		title: 'One map, all kinds of decision.',
		typesLabel: 'The business types scored',
		rows: [
			'Retail & F&B investors',
			'Small businesses on a tight budget',
			'First-time owners',
			'Expansion teams',
			'Property owners & agents',
			'Site finders'
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
		'not-covered': 'Not yet surveyed',
		/* Not a gap in the data, but a question nobody has asked yet. */
		'no-type': 'No business type yet'
	},

	supply: {
		denseBusy: 'they sit close together and most are busy, so the gap is narrow',
		denseQuiet: 'they sit close together but most are quiet, which reads as saturation',
		fewBusy: 'there are few of them but most are busy, so demand looks pent up',
		fewQuiet: 'there are few of them and most are quiet'
	},


	/* ── Score composition ─────────────────────────────────────────────────
	   The panel that answers "why this number?". The order is deliberate: the
	   transit nodes lead, because they are the point of this project, and the
	   step-by-step arithmetic follows. This note used to call transit the one input
	   built from real data. Every input is now, so that reason no longer holds. */
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
			access: 'Transit access',
			cost: 'Cost of space'
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
				`×${pengali.toFixed(2)} = 0.60 + 0.40 × access index ${akses.toFixed(2)}`,
			/* The cost step is shown on every cell, including the ones it did not touch.
			   Its four silences are kept apart, because "not surveyed", "nothing for
			   sale", "for sale with no price on it" and "cheapest on the grid" are four
			   different sentences, and only the first means nobody has looked. */
			cost: (pengali: number, peringkat: number) =>
				`×${pengali.toFixed(2)} · dearer than ${peringkat}% of cells`,
			costCheapest: (pengali: number) =>
				`×${pengali.toFixed(2)} · cheapest on the grid, nothing taken off`,
			costUncovered: 'the property catalogue has not been read for this city, nothing taken off',
			costEmpty: 'no commercial unit for sale within range, nothing taken off',
			costUnpriced: (n: number) =>
				`${n} ${n === 1 ? 'unit is' : 'units are'} for sale nearby with no price on ${n === 1 ? 'it' : 'them'}, nothing taken off`,
			costThin: (n: number) =>
				`only ${n} priced ${n === 1 ? 'unit' : 'units'} nearby, too few to take a median from`,
			costUngraded: 'too few prices across the grid to rank this one against, nothing taken off'
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

	/* ── Cost of space ─────────────────────────────────────────────────────
	   This panel answers "what does the space cost here". One thing must never
	   blur: THE MAPID CATALOGUE HAS NO RENT. Every figure here is an asking
	   price to buy, and not one of them may be read as a monthly rent. Getting
	   a rent out of a sale price takes a yield assumption, and that assumption
	   would be the only number on the screen that came from nobody's data. */
	property: {
		title: 'Cost of space',
		/* Led with, not tucked into a footnote. The reader came looking for rent,
		   and rent is not what the catalogue holds. */
		saleNote:
			'This is an asking price to buy, not a rent. The MAPID catalogue carries no rental listings for Jakarta at all, so there is no monthly rent to show without inventing the assumption behind it.',
		perM2: 'per m² of land',
		medianOf: (n: number, r: number) =>
			`median of ${n} ${n === 1 ? 'unit' : 'units'} on the market within ${r} m`,
		priceValue: (v: number) => rp(v),
		/* A rank, not a ratio. Asking prices per m² in Jakarta run across two orders
		   of magnitude and a handful of very large parcels sit at the bottom of the
		   per-m² scale, so a ratio is easily dragged about by outliers. A rank is not. */
		rank: (persen: number) => `Dearer than ${persen}% of the cells with a readable price.`,
		rankCheapest: 'This is the cheapest of the cells with a readable price.',
		rankDearest: 'This is the dearest of the cells with a readable price.',
		vsMedian: (v: number, kali: number) =>
			`The grid median is ${rp(v)} per m², so this is ${kali.toFixed(1)}× that.`,
		/* What the figure did to the score. Read back off the scoring engine, never
		   recomputed here. */
		effect: (poin: number, pengali: number) =>
			`That price takes ${poin} ${poin === 1 ? 'point' : 'points'} off this cell, a multiplier of ×${pengali.toFixed(2)}.`,
		effectNone: 'The cost of space took nothing off this cell.',
		floor: (pengali: number) =>
			`The cost of space can take a cell down to ×${pengali.toFixed(2)} at most. It tilts the ranking rather than deciding it: an asking price is one negotiation away from being wrong, and it is a price to buy rather than to occupy.`,

		/* ── Four kinds of silence, kept apart ──────────────────────────────
		   Only the first means nobody has looked. */
		noneUncovered:
			'The property catalogue has not been read for this city, so there is nothing to say yet about what space costs here. That is not the same as nothing being for sale.',
		noneEmpty: (r: number) =>
			`No commercial unit is on the market within ${r} m. That was checked, and there genuinely is none.`,
		noneUnpriced: (n: number) =>
			`${n} ${n === 1 ? 'unit is' : 'units are'} on the market nearby, and not one carries a price. So the price is left empty rather than estimated.`,
		noneThin: (n: number, min: number) =>
			`Only ${n} ${n === 1 ? 'unit' : 'units'} nearby carry a price. A median needs at least ${min}, because a single misplaced decimal point is enough to move this whole cell to the expensive end.`,
		noneUngraded:
			'This cell has a readable price, but too few other cells do for it to be ranked against them. So it cannot yet be called dear or cheap, and nothing was taken off the score.',

		/* ── What is on the market ──────────────────────────────────────────── */
		marketTitle: 'On the market here',
		marketCount: (n: number, r: number) =>
			`${n} commercial ${n === 1 ? 'unit' : 'units'} within ${r} m`,
		marketPremises: (n: number) => `${n} of them could hold a small business`,
		marketNone: 'No commercial unit is on the market here.',
		marketLoading: 'Loading the units…',
		marketFailed:
			'The list of units could not be loaded. The price and the counts above still hold, both are read from the grid, not from that file.',
		/* Type names. The keys come from the data (TIPE_2 in the catalogue) rather
		   than from a translation, so both languages have to carry all of them. */
		types: {
			ruko: 'Shophouse',
			toko: 'Shop or kiosk',
			ruang: 'Business space',
			rukan: 'Shop-office',
			komersial: 'Other commercial',
			kantor: 'Office',
			gedung: 'Building',
			gudang: 'Warehouse'
		},
		typeAside: 'not premises for a small business',

		/* ── The units, one by one ──────────────────────────────────────────── */
		unitsTitle: 'The nearest units, one by one',
		unitPrice: (v: number) => rp(v),
		unitNoPrice: (n: number) =>
			`+${n} more ${n === 1 ? 'unit' : 'units'} a business could take, with no price on ${n === 1 ? 'it' : 'them'}`,
		unitWalk: (m: number) => `${m} m`,
		/* The unit's characteristics, and only the ones genuinely in the data. An
		   empty column is skipped rather than written as zero: a building with no
		   floor count published and a single-storey building are not the same thing. */
		unitLand: (m2: number) => `${num(m2)} m² land`,
		unitBuild: (m2: number) => `${num(m2)} m² floor`,
		unitFloors: (n: number) => `${n} ${n === 1 ? 'floor' : 'floors'}`,
		unitPerM2: (v: number) => `${rp(v)}/m²`,
		unitsMore: (n: number) => `+${n} more`,
		/* Map label. The price can be absent when the listing published none, and the
		   sentence has to stand up without it. */
		mapUnitAria: (jenis: string, harga: string, m: number) =>
			harga
				? `${jenis} for sale at ${harga}, ${m} m from the cell centre`
				: `${jenis} for sale with no price published, ${m} m from the cell centre`,
		mapShow: 'Show on map',
		mapHide: 'Hide from map',
		provenance: (n: number, kota: number) =>
			`${num(n)} commercial property listings from the MAPID Data Premium catalogue, across ${kota} administrative ${kota === 1 ? 'city' : 'cities'}. Every one of them is for sale.`
	},

	/* Field notes: MAPID Apps surveys somebody walked, not a catalogue. The
	   difference has to show in every sentence. The competitor catalogue claims to
	   hold every coffee shop in Jakarta, so a zero there is a finding. This claims
	   nothing of the sort: 191 of the 562 cells carry a record, and an empty one only
	   means nobody has been. Which is why every label says "recorded". */
	field: {
		title: 'Field notes',
		notCensus:
			'These are notes from people who went and stood there, not a census. An area with nothing recorded is not necessarily quiet, it may just be one nobody has walked yet.',
		none: 'Nobody has recorded anything in this area yet.',
		loading: 'Loading the records…',
		failed: 'The records did not load. Every figure above is intact, only the list is missing.',
		count: (n: number) => `${num(n)} ${n === 1 ? 'record' : 'records'} in this area`,
		last: (tanggal: string) => `Last recorded ${tanggal}.`,
		mapShow: 'Show on map',
		mapHide: 'Hide from map',
		walk: (m: number) => `${m} m`,
		more: (n: number) => `+${n} more`,

		/* Struk Go */
		strukTitle: 'Receipts',
		strukCount: (n: number) => `${num(n)} ${n === 1 ? 'receipt' : 'receipts'} photographed here`,
		cashless: (persen: number) => `${persen}% of them were paid without cash.`,
		cashlessThin: (n: number, min: number) =>
			`Only ${n} ${n === 1 ? 'receipt names' : 'receipts name'} a payment method. Under ${min} of them, a share says nothing.`,

		/* Menu Go */
		menuTitle: 'Places to eat',
		menuCount: (n: number) => `${num(n)} ${n === 1 ? 'place' : 'places'} a surveyor walked into`,
		menuTypical: (v: number) => `A meal here runs to about ${rp(v)}.`,
		menuTypicalThin: (n: number, min: number) =>
			`Only ${n} ${n === 1 ? 'place has' : 'places have'} a price written down. Under ${min}, that is one warung's price and not the area's.`,
		menuPrice: (v: number) => `${rp(v)} on average`,
		menuNoPrice: (n: number) => `+${n} more with no price written down`,
		crowd: { sepi: 'quiet', sedang: 'steady', ramai: 'queueing' },
		crowdSeen: (kata: string) => `on the day: ${kata}`,

		/* Properti Go. The only source of rentals this product has, so the copy says
		   so outright. What the form records is the OFFER, and it never asks the price. */
		propTitle: 'Space being offered',
		propCount: (n: number) => `${num(n)} ${n === 1 ? 'place' : 'places'} recorded here`,
		propRent: (n: number) => `${n} of them are up for rent.`,
		propNoRent: 'All for sale, none of them up for rent.',
		rentNote:
			'This survey is the only one that records a rental. It records the offer, and it never asks what the rent is.',
		offer: { sewa: 'For rent', jual: 'For sale' },

		/* Community notes */
		noteTitle: 'What people wrote',
		noteCount: (n: number) => `${num(n)} ${n === 1 ? 'note' : 'notes'} about the streets around here`,
		noteBy: (nama: string) => `by ${nama}`,

		provenance: (n: number, petak: number, total: number) =>
			`${num(n)} MAPID Apps field records, spread across ${petak} of the ${total} areas. Not one of them enters the score.`,

		/* The date is written in the locale file rather than the component: month names
		   and their order differ by language, and components only ever hand over a
		   number or an ISO string. */
		day: (iso: string) => {
			const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			const [y, m, d] = iso.split('-').map(Number);
			return month[m - 1] ? `${d} ${month[m - 1]} ${y}` : iso;
		},
		mapAria: (jenis: string, tempat: string, m: number) =>
			`${jenis}: ${tempat}, ${m} m from the cell centre`,
		kinds: {
			struk: 'Receipt',
			menu: 'Place to eat',
			properti: 'Property',
			catatan: 'Community note'
		}
	},

	/* ── Opening hours ──────────────────────────────────────────────────────
	   One word deliberately absent here: busy. What is counted is DOORS open, from
	   OpenStreetMap's `opening_hours` tag, not people going through them. The chart
	   is the shape of Google's popular times and a different measurement altogether.
	   The field notes carry the spending side, and they hold no hour at all, only a
	   date. So the two cannot be drawn as one curve. */
	activity: {
		title: 'When this area is open',
		dayPicker: 'Pick a day',
		days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		dayFull: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		/* Axis labels every six hours. English reads a bare "18" as a quantity, so this
		   side keeps the am and pm and drops the minutes instead. */
		hourShort: (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`),
		barTitle: (h: number, n: number, dari: number) =>
			`${hour(h)}, ${n} of ${dari} businesses open`,
		/* Jakarta's clock, not the reader's. The doors are in Jakarta. */
		nowOpen: (h: number, n: number, dari: number) =>
			`It is ${hour(h)} in Jakarta right now, and ${n} of these ${dari} are open.`,
		peak: (h: number, n: number, dari: number) =>
			`Most of them are open from ${hour(h)}, ${n} of the ${dari}.`,

		/* ── Two kinds of silence, kept apart ─────────────────────────────── */
		thin: (terbaca: number, min: number, usaha: number, r: number) =>
			`Only ${terbaca} of the ${usaha} businesses on record within ${r} m publish hours that can be read. A curve needs at least ${min}, because one 24-hour minimart among three shops draws a street that never sleeps.`,
		none: (usaha: number, r: number) =>
			`Not one of the ${usaha} businesses on record within ${r} m publishes its opening hours. So the hours are left empty rather than guessed at.`,

		/* The count names OpenStreetMap on purpose. The sentence at the top of this panel
		   counts the thirteen business types SpotOn scores, from OSM and MAPID together.
		   This one counts every trade OSM has on record, so the two figures differ and a
		   reader is owed the reason they differ. */
		basis: (terbaca: number, usaha: number, r: number) =>
			`${terbaca} of the ${usaha} businesses OpenStreetMap lists within ${r} m publish opening hours that can be read.`,
		refused: (n: number) =>
			`${n} more publish them in a form this reader will not guess at, a public holiday rule or "sunset" for instance. Those are left out rather than approximated.`,
		notFootfall:
			'This counts doors open, not people walking past. The receipts surveyors logged are below, kept separate, because those carry a date and no hour.',
		loading: 'Loading the opening hours…',
		failed: (n: number) =>
			`The opening hours could not be loaded, so no curve is drawn. The count of ${n} businesses below still holds, it is read from the grid rather than from that file.`
	},



	mood: {
		busiest: 'at its busiest',
		busy: 'fairly busy',
		quiet: 'a bit quiet',
		empty: 'quiet',
		nodata:
			'This cell sits in a city the catalogue has not been read for, so the street is deliberately left empty. That does not mean it is actually deserted.',
		reading: (n: number, kata: string) =>
			`There are ${n} businesses within walking range here, so it is ${kata}.`,
		rivals: (n: number, cat: string) => `${n} of them are ${cat}`,
		listings: (n: number) => `and ${n} units are on the market.`,
		noListings: 'and nothing is on the market.',
		rows: {
			score: 'Opportunity score',
			demand: 'Busyness',
			supply: 'Effective supply',
			around: 'Other businesses nearby',
			rivals: 'Competitors of this kind',
			access: 'Transit access',
			space: 'Units on the market'
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
		/* The competitors, drawn where they actually stand. Shared wording with the
		   transit switch above, because it is the same promise about the same map. */
		rivalsOnMap: 'Competitors on the map',
		rivalsCount: (n: number, cat: string) =>
			`${n} ${cat} drawn where they actually stand, within the same walking range.`,
		/* Switched off, the sentence above would be describing a map that is not there.
		   Same figure, and it says what to press to see it. */
		rivalsHidden: (n: number, cat: string) =>
			`${n} ${cat} inside the walking range. Show them to see where they stand.`,
		rivalsLoading: 'Looking up where they stand…',
		/* Stations are labelled and these are not, so the difference gets a reason. The
		   names exist in the MAPID features, they were simply not kept when the point
		   file was written, and a re-fetch brings them in. */
		rivalsNoNames:
			'None of them carry a name in the data yet, so they are drawn as marks only.',
		rivalsNone: 'No competitors of this type inside the walking range.',
		/* Only MAPID carries positions. Saying which source would have them is the
		   difference between a dead end and a fix the reader can act on. */
		rivalsNoPositions:
			'OSM gives competitor counts but not their positions, so there is nothing to draw. Switch the source to MAPID in the legend to see where they are.',
		rivalsFailed: 'Could not load the competitor positions. The counts beside them are unaffected.',
		prov: 'Business points & property: MAPID catalogue. Competitors & transit nodes: OSM.',
		sceneLabel: (nama: string, isi: string) => `Schematic of ${nama}. ${isi}`,
		sceneNodata: "This area's city has not been surveyed, so the street is shown empty.",
		sceneBody: (n: number, osm: number, cat: string, unit: number) =>
			`${n} businesses within walking range, ${osm} of them competing ${cat}, and ${unit} units on the market.`,
		/* No business type has been named. The counts are still given because they were
		   genuinely counted; the rivals are not, because rivals of WHAT is precisely the
		   question that has not been asked. */
		sceneNoType: (n: number, unit: number) =>
			`${n} businesses within walking range and ${unit} units on the market.`,
		askForScore: 'Say what you want to open and I will work out this area\'s opportunity score.'
	},

	/* ── app ──────────────────────────────────────────────────────────────── */

	app: {
		radiusLabel: 'Range',
		radiusValue: (m: number) => `${m} m`,
		radiusAria: 'The walking range being scored',
		radiusHint:
			'How far from the centre counts, for areas and for places alike. Each range has its own price, measured rather than interpolated from another.',
		categoryLabel: 'Business type',
		coverage: (terdata: number, total: number, poi: number) =>
			`${terdata}/${total} cells · ${poi} competitors mapped`,
		/* The competitor count only exists once a category's columns are loaded. Until
		   then the sentence stops at the cells — writing "0 competitors mapped" claims
		   to have counted and found nobody, when nothing has been counted at all. */
		coverageCells: (terdata: number, total: number) => `${terdata}/${total} cells`,
		coverageTitle: 'Cells in a surveyed city, and the number of similar businesses recorded',
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
		/* The opening map: no business type has been named, so there is no opportunity
		   score to give. The one thing that can be counted without a business type is how
		   many businesses stand within walking range, whatever they sell. */
		basisDensity: 'Businesses around',
		basisDensityUnit: 'every business type',
		basisDensityLow: '0 · quiet',
		basisDensityHigh: 'busiest',
		basisDensityCells: (n: number) => `${n} cells sit in an unsurveyed city, not counted`,
		sourceLabel: 'Competitor data source',
		sourceBothLabel: 'Both',
		/* "Both" is not a sum, and this line is what keeps it from being read as one.
		   The two surveys read the same city, so adding them counts the same shops
		   twice. */
		sourceBoth: 'Each area is read from whichever survey reached it, the fuller one where both did. Never added together.',
		sourceOsm: 'OpenStreetMap: even coverage, volunteered',
		sourceMapid: 'MAPID: surveyed, all 5 Jakarta cities',
		legendUncovered: (n: number, cat: string, src: string) =>
			`${n} cells are not covered by ${src} data for ${cat}, so they are unscored. That is not the same as having no competitors`,
		legendUncoveredAll: (cat: string, src: string, other: string) =>
			`${src} has no competitor data for ${cat}, so nothing can be scored. Try the ${other} source.`,
		legendNodata: (n: number) => `${n} cells sit in an unsurveyed city, left unscored`,
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
		/* What a cell reads before a business type has been named: a count of the trade
		   around it, not an opportunity score. */
		tipDensity: 'businesses around',
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
		/* The way out for someone who would rather not be asked first. It names what
		   you get rather than what you are skipping, and Tapak is still there on the
		   right afterwards, so nothing is given up by taking it. */
		launchSkip: 'Just show me the map',
		/* The chips are framed as examples, not a menu. Without this label a row of
		   business-type buttons reads as "these are the only things you may ask". */
		closeArea: 'Close area',
		dismissRemark: "Dismiss Tapak's note",
		home: 'Back to the SpotOn home page',
		emptyMood: 'No area selected yet. Tap a cell on the map to see what it feels like.',
		pickBest: (cat: string) => `Pick the best one for a ${cat}`,
		schema: 'schematic, not an actual site plan',
		fullNumbers: 'See the full figures',
		/* The map's own badge, pinned to the selected cell. Deliberately the count and
		   nothing else: the breakdown is in the panel, what the map has to carry is
		   "how many". */
		mapStops: (n: number) => `${n} transit ${n === 1 ? 'node' : 'nodes'}`,
		mapStopsAria: (n: number, r: number) =>
			`${n} transit ${n === 1 ? 'node' : 'nodes'} within a ${r} m walk of this cell`,
		/* The number of competitor dots actually drawn, not the panel's figure. The
		   badge and the map it sits on must never disagree. */
		mapRivals: (n: number) => `${n} ${n === 1 ? 'competitor' : 'competitors'}`,
		mapRivalsAria: (n: number, r: number) =>
			`${n} similar ${n === 1 ? 'business' : 'businesses'} within a ${r} m walk of this cell`,
		mapReach: (r: number) => `${r} m reach`,
		tipNodata: 'City not surveyed yet · survey priority candidate',
		tipScore: (cat: string) => `${cat} score`,
		tipBusy: (n: number) => `${n} businesses nearby`,
		tipRivals: (n: number) => `${n} competitors`,
		tipUnits: (n: number) => `${n} units listed`,
		sheet: 'Information panel',
		sheetGrip: 'Resize panel'
	},

	tapak: {
		/* This used to quote two numbers: how many cells, then how many of them have
		   data. Since both surveys are read together the two are the same number, and
		   the sentence read "562 cells, and 562 of them have data". */
		greet: (total: number) =>
			`Hello, I'm Tapak. I've been round ${total} cells near the MRT, KRL, LRT and TransJakarta corridors. What are you thinking of opening?`,
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
		/* Understood, and one word short. Not a refusal: what is missing is the business
		   type, not the data, and an opportunity score means nothing without one. */
		needsCategory:
			'Before I answer, what do you want to open? An opportunity score is always for one kind of business, because 83 for a coffee shop is not 83 for a laundry.',
		notUnderstood: (why: string) =>
			`${why} All I know is the areas around Jakarta transit, for a set of business types. Want me to look at one of those?`,
		coverageNone: 'Every area has data.',
		coverageSome: (n: number) =>
			`There are ${n} areas I have no data for at all. I'm not scoring them. Rather than make something up, I'd rather say I don't know.`,
		saturatedNone: 'Nothing is genuinely crowded for this business.',
		saturatedSome: (n: number, cat: string) =>
			`These ${n} areas are the ones to avoid for now for a ${cat}. The competitors sit close together and most of them are busy.`,
		compare: 'Side by side, here is how they compare.',
		rankNone: (cat: string) =>
			`Nothing fits a ${cat} under those conditions yet. Want me to loosen them?`,
		rankBy: (name: string, ukuran: string, nilai: string, n: number) =>
			`By ${ukuran}, ${name} comes top at ${nilai}. Here are the top ${n} from my notes.`,
		rankTop: (name: string, nilai: string | null, n: number) =>
			`If it were up to me, ${name} first${nilai ? `, scoring ${nilai} out of 100` : ''}. Here are the top ${n} from my notes.`,
		/* Added only when the question asked for a mode. What I name above is always
		   an area, because the sums run on the grid, and the panel beside it lists the
		   premises standing inside those areas. Both are true and they are not the
		   same list. */
		nowByUnit:
			'I have switched the map to read by place, so each row is one premises rather than an area.',
		nowByCell: 'I have switched the map back to reading by area, so each row is an area again.',
		remarkUncovered: (name: string, cat: string) =>
			`${name} sits in a city the catalogue has not been read for, so the ${cat} around it have never been counted and I won't put a number on it. That does not mean it has no competitors.`,
		remark: (name: string, verdict: string, cat: string, nilai: string, osm: number, listing: string) =>
			`${name} is ${verdict} for a ${cat}, scoring ${nilai}. There are ${osm} similar businesses, and ${listing}.`,
		verdictGood: 'one of the good ones',
		verdictMid: 'middling',
		verdictLow: 'honestly not promising',
		listingSome: (n: number) => `${n} units on the market`,
		listingNone: 'nothing on the market'
	},

	/* ── Small talk ────────────────────────────────────────────────────────
	   The canned lines for a turn that was not a question about the data. Used
	   when there is no model, and when the model's reply carried a digit and was
	   thrown away by `domain/chat`. Same voice as the rest of Tapak: friendly,
	   short, and always turning back to what the map can answer.

	   No figures here either. Not because the code checks these, but because a
	   canned line containing one would be an example of the thing being banned. */
	chat: {
		sapaan:
			"Hello. Transit areas in Jakarta are all I know about, but I know them fairly well. What kind of business are you thinking of?",
		tentang:
			'I am Tapak, your guide in SpotOn. I read footfall, how many rivals are already there, and what space is on the market in each cell around a station, then answer from those figures. Where there is no data, I say so.',
		usaha:
			'What usually decides it is who walks past, who is already selling there, and whether there is space you can actually take. Those three are the ones I can put numbers to, area by area.'
	},

	/* ── The unit pivot ────────────────────────────────────────────────────
	   The map's second mode: the row is a unit on the market rather than a
	   catchment. The keys come from `domain/units`, so a measure added there
	   needs a name here and in id.ts.

	   `harga` is still an asking price to BUY. There are no rental listings in
	   the MAPID catalogue for Jakarta, and calling it rent here would be the
	   one sentence in this product that is not true. */
	units: {
		title: 'Places on the market',
		pivotCell: 'By area',
		pivotUnit: 'By place',
		pivotHint: 'Change what counts as a row: the area, or the premises themselves',
		count: (n: number) => `${num(n)} places a business could take`,
		filteredOut: (n: number) => `${num(n)} more filtered out`,
		unmeasured: (n: number, ukuran: string) =>
			`${num(n)} more are unranked because their ${ukuran.toLowerCase()} is not measured`,
		rampLow: 'bottom of the list',
		rampHigh: 'top of the list',
		rampNodata: 'not measured, so not ranked',
		rampNote: (ukuran: string) =>
			`The dots on the map follow this list's order, not the area score. The darkest are the top of it by ${ukuran.toLowerCase()}.`,
		none: 'Nothing gets through these filters. Loosen one of them.',
		more: (n: number) => `+${num(n)} more, sort or filter to narrow it down`,
		cellScore: (nilai: string) => `area scores ${nilai}`,
		cellUnscored: 'its area is unscored for this business type',
		provenance:
			'Each place is matched to the nearest cell whose centre is still within walking distance. The area figures come from that cell, not from the doorway itself.',
		metrics: {
			harga: 'Price',
			harga_m2: 'Price per m²',
			luas_tanah: 'Land area',
			luas_bangunan: 'Floor area',
			lantai: 'Floors',
			skor_petak: 'Area score',
			permintaan_petak: 'Area demand',
			pesaing_petak: 'Rivals nearby',
			akses_petak: 'Transit access',
			jarak_pusat: 'Distance to cell centre'
		},
		value: (k: string, v: number) => {
			if (k === 'harga') return rp(v);
			if (k === 'harga_m2') return `${rp(v)}/m²`;
			if (k === 'luas_tanah' || k === 'luas_bangunan') return `${num(Math.round(v))} m²`;
			if (k === 'jarak_pusat') return `${num(Math.round(v))} m`;
			if (k === 'skor_petak' || k === 'permintaan_petak' || k === 'akses_petak') {
				return String(Math.round(v * 100));
			}
			return num(Math.round(v));
		},
		/* ── The card's header badge ────────────────────────────────────────
		   The two cards are deliberately alike, so the badge is what tells 800 m
		   of city apart from one front door. */
		markCell: 'One area of the grid',
		markUnit: 'One place on the market',

		cardIn: (petak: string) => `in ${petak}`,
		cardWalk: (m: number) => `${num(m)} m from the cell centre`,
		cardAbout: 'About the place',
		cardArea: 'About the area',
		cardFigures: 'See every column on the listing',
		cardNoScore:
			'This cell has no competitor coverage for the selected business type, so it has no score yet. What is said about the place above still holds.',
		/* The listing's own columns. Empty ones are skipped rather than filled with
		   a dash: half the catalogue leaves the floor count or the certificate
		   blank, and a table of dashes reads as a unit with nothing to say. */
		rows: {
			type: 'Type',
			cell: 'Its area',
			distance: 'From the cell centre',
			price: 'Asking price',
			ppm: 'Price per m² of land',
			land: 'Land',
			build: 'Building',
			floors: 'Floors',
			cert: 'Certificate'
		}
	},

	query: {
		/* The conjunction for a list of business types asked about at once. Here rather
		   than in the code, because each language joins a list its own way. */
		and: 'and',
		saturated: 'already crowded',
		coverage: 'with no data yet',
		within: (r: number) => `within ${r === 800 ? 'an' : 'a'} ${r} m walk of a transit stop`,
		hasSpace: 'has space for rent',
		cheap: 'lower rent bracket',
		/* The two things an answer changes about the MAP rather than about the
		   ranking. Named so a reader who watched the map move can tell which part
		   of what they are looking at they actually asked for. */
		pivotCell: 'read by area',
		pivotUnit: 'read by place',
		radius: (r: number) => `measured over ${r} m on foot`,
		/* ── The measures a question can be about ───────────────────────────
		   The keys come from `domain/metrics`, so a measure added there needs a
		   name here and in id.ts. `harga_tempat` is deliberately not called
		   "rent": the MAPID catalogue carries no rental listings for Jakarta, and
		   naming it that would be the one untruth on the screen. */
		metrics: {
			skor: 'opportunity score',
			permintaan: 'how busy the area is',
			penawaran: 'effective supply',
			pesaing: 'competitor count',
			keramaian: 'businesses nearby',
			harga_tempat: 'asking price to buy',
			unit_dipasarkan: 'units on the market',
			akses_transit: 'transit access',
			simpul_transit: 'transit nodes',
			struk_dicatat: 'receipts recorded',
			sewa_ditawarkan: 'premises up for rent'
		},
		sortedBy: (ukuran: string, naik: boolean) =>
			`sorted by ${ukuran}, ${naik ? 'lowest' : 'highest'} first`,
		band: (ukuran: string, arah: 'rendah' | 'tinggi' | 'ada') =>
			arah === 'ada'
				? `has some ${ukuran}`
				: `${ukuran} in the ${arah === 'rendah' ? 'bottom' : 'top'} third`,
		perM2: (v: number) => `${rp(v)}/m²`,
		count: (v: number) => num(Math.round(v))
	},

	/* The sample questions on the landing page, written whole, the way somebody who
	   already knows what they want types them. They used to be split across four turns
	   of back-and-forth, which on a sales page is a long time to wait before anything
	   is answered. */
	demo: {
		askOpen: (kind: string) => `Where should I open ${kind} near a station?`,
		askCheap: (kind: string) => `Where can I open ${kind} on a small budget near the MRT?`,
		askSaturated: (kind: string) => `Which areas are already too crowded with ${kind}?`
	}
};
