import type { Copy } from './id';
import { moneyScale } from '$lib/utils/format';
import type { DayPart, Greetings } from '$lib/types';

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
 * The zone the week boundary stands in.
 *
 * An allowance turns over at midnight on Monday in Jakarta, and that is one instant, not
 * one date. Written in the reader's own clock the same instant lands on a Sunday for
 * somebody in Europe, and the sentence about their quota would name a Sunday while the
 * rule names a Monday. The rule lives in `domain/plans`; this is how it is written down.
 */
const JAKARTA = 'Asia/Jakarta';

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

/** An hour that can sit between two hours, English: 7.5 → "7.30am". A scrubbed clock
    stops wherever it is dragged, and `hour` above has no minutes to write it with. */
const clockHour = (h: number): string => {
	const clock = ((h % 24) + 24) % 24;
	const whole = Math.floor(clock);
	const mins = Math.floor((clock - whole) * 60);
	const half = whole < 12 ? 'am' : 'pm';
	return `${whole % 12 === 0 ? 12 : whole % 12}.${String(mins).padStart(2, '0')}${half}`;
};

/**
 * The opening salutation, following the clock on the reader's own device.
 *
 * Used in two places: alone above the question on the opening card, and as Tapak's
 * first sentence in the panel. So each wording has to stand as a sentence on its own
 * AND still read well with "I'm Tapak." following it.
 *
 * The clock is all that is known here. Nothing in this product knows whether the
 * street outside is busy, what the weather is doing, or whether the reader has had a
 * long day. The rule that keeps invented figures off the screen is the same rule with
 * the number taken out, and a greeting saying the shops are just opening is exactly
 * that invention.
 *
 * The bands are the Indonesian ones, which is why there are five rather than the
 * three or four English would reach for. `sore` is a real part of a Jakarta day and
 * English has no single word for it, so it is worded as the late afternoon it is
 * rather than folded into the evening.
 *
 * Three wordings per part, rotated by the day in `domain/daypart` rather than drawn
 * at random: somebody who reloads to check something reads the same sentence instead
 * of watching the page change its mind.
 */
const SALUTE: Record<DayPart, Greetings> = {
	dini_hari: ['Past midnight.', 'Still up at this hour.', 'The small hours.'],
	pagi: ['Good morning.', 'Morning. The day is still long.', 'Up early, looking at places.'],
	siang: ['Good afternoon.', 'Midday. Time for a break.', 'The middle of the day.'],
	sore: ['Late afternoon.', 'Getting on for evening.', 'Good afternoon.'],
	malam: ['Good evening.', 'Evening. A quiet hour to weigh things up.', 'Evening already.']
};

export const en: Copy = {
	lang: { code: 'en', label: 'English', short: 'EN', switchTo: 'Switch to Indonesian' },

	brand: {
		name: 'SpotOn',
		tagline: "Don't guess where to open. Ask the map.",
		appTagline: 'Site selection around Jakarta transit',
		open: 'Open SpotOn'
	},

	/* The salutation, by the reader's own clock. The opening card says it alone and
	   Tapak opens with it, so both greet with the same words in one visit. */
	greeting: SALUTE,

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
		meet: {
			title: 'Meet Tapak, your guide.',
			body: 'Tapak reads the question, works out what to look up, then answers with the reasons attached. The model writes the sentence. It does not write the figures: every one of those is computed by the scoring engine on the data, and a figure that is not among them is thrown out before it reaches the screen. Where a catchment has never been surveyed, Tapak says so rather than filling the gap.'
		},
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
			computing: 'Now counting it up from my notes',
			/* The figures exist by the time this line shows. What is left is the
			   sentence, and saying so is more honest than "one moment". */
			writing: 'I have the figures, putting the answer together'
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
			`A grid of ${total} cells: ${terdata} sit in a surveyed city, ${nodata} do not.`,
		/* The field notes, mentioned without naming a single product. What a reader
		   cares about is what they get, not which dataset it came out of. */
		notesTitle: 'Some areas carry notes from people who went there.',
		notesBody: (n: string) =>
			`${n} field notes: receipts, what a meal costs, how busy the place looked when somebody called in, and space being offered to rent. All of it photographed, so the street can be seen first.`
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
		stopsSub: (r: number) => `within a ${r} m walk of the cell centre · OSM`,
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
		splitBase: 'demand and competition',
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
			demand: (nilai: number) => `how busy it is around here, ${nilai} out of 100`,
			supply: (nilai: number) => `how crowded the trade already is, ${nilai} out of 100`,
			clamp: 'the result is kept between 0 and 100',
			gateOff: 'the requirement is switched off',
			gatePass: (n: number) => `${n} ${n === 1 ? 'unit' : 'units'} up for rent, requirement met`,
			gateBlock: () => 'nothing up for rent here',
			access: () => 'from the transit nodes within a walk of here',
			/* The cost step is shown on every cell, including the ones it did not touch.
			   Its four silences are kept apart, because "not surveyed", "nothing for
			   sale", "for sale with no price on it" and "cheapest on the grid" are four
			   different sentences, and only the first means nobody has looked. */
			cost: (peringkat: number) => `dearer than ${peringkat}% of cells`,
			costCheapest: () => 'cheapest on the grid, so nothing taken off',
			costUncovered: 'what space costs in this city has not been collected, nothing taken off',
			costEmpty: 'no commercial unit for sale within range, nothing taken off',
			costUnpriced: (n: number) =>
				`${n} ${n === 1 ? 'unit is' : 'units are'} for sale nearby with no price on ${n === 1 ? 'it' : 'them'}, nothing taken off`,
			costThin: (n: number) =>
				`only ${n} priced ${n === 1 ? 'unit' : 'units'} nearby, too few to go on`,
			costUngraded: 'too few prices across the grid to rank this one against, nothing taken off'
		},
		total: 'Opportunity score',
		deltaAria: (poin: number) =>
			poin > 0
				? `up ${poin} ${poin === 1 ? 'point' : 'points'}`
				: poin < 0
					? `down ${Math.abs(poin)} ${Math.abs(poin) === 1 ? 'point' : 'points'}`
					: 'no change',

		accessTitle: 'Where the transit access comes from',
		accessRow: (n: number) => `${n} ${n === 1 ? 'node' : 'nodes'}`,
		accessShare: (persen: number) => `${persen}% of the access`,
		accessIndex: (akses: number) =>
			`Transit access here is ${Math.round(akses * 100)} out of 100.`,
		accessFormula:
			'The more nodes in range, the higher it goes. Rail counts for more than a bus because it carries more people. Read from OSM.',

		stationsTitle: 'The nodes in range, one by one',
		stationsLoading: 'Loading the list of nodes…',
		stationsFailed:
			'The list of node names could not be loaded. The counts and the access index above are unaffected.',
		modeGroup: (moda: string, n: number) => `${moda} · ${n} ${n === 1 ? 'node' : 'nodes'}`,
		unnamed: (n: number) =>
			`+${n} more with no name of their own, usually platforms of the same station`
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
			'This is an asking price to buy, not a rent. The MAPID catalogue carries no rental listings for Jakarta at all, so there is no monthly rent to show.',
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
		effect: (poin: number) =>
			`That price takes ${poin} ${poin === 1 ? 'point' : 'points'} off this cell.`,
		effectNone: 'The cost of space took nothing off this cell.',
		floor:
			'The cost of space tilts the ranking without deciding it. An asking price is one negotiation away from being wrong, and it buys the place outright.',

		/* ── Four kinds of silence, kept apart ──────────────────────────────
		   Only the first means nobody has looked. */
		noneUncovered:
			'What space costs in this city has not been collected yet, so there is nothing to show here.',
		noneEmpty: (r: number) =>
			`Nothing commercial is on the market within ${r} m. This city has been surveyed, and there is genuinely none.`,
		noneUnpriced: (n: number) =>
			`${n} ${n === 1 ? 'unit is' : 'units are'} on the market nearby, and not one carries a price.`,
		noneThin: (n: number) =>
			`Only ${n} ${n === 1 ? 'unit' : 'units'} nearby ${n === 1 ? 'carries' : 'carry'} a price. Too few to stand for what space costs here.`,
		noneUngraded:
			'This cell has a readable price, but too few other cells do for it to be ranked against them. So it cannot yet be called dear or cheap, and nothing was taken off the score.',

		/* ── What is on the market ──────────────────────────────────────────── */
		/* The price above belongs to the area, the list below to the place. This is what
		   stops one word "here" standing for two different points of measurement. */
		medianIsCell: (r: number) =>
			`The price above is the area's median, measured from the cell centre over ${r} m. The list below is what is on the market within ${r} m of this place.`,
		marketTitle: 'On the market here',
		marketTitlePlace: 'On the market around this place',
		marketCount: (n: number, r: number) =>
			`${n} commercial ${n === 1 ? 'unit' : 'units'} within ${r} m`,
		marketPremises: (n: number) => `${n} of them could hold a small business`,
		marketNone: 'No commercial unit is on the market here.',
		marketNonePlace:
			'No other commercial unit is on the market within walking range of this place.',
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
			'These are notes from people who went and stood there, not a census. An area with nothing recorded is one nobody has walked yet.',
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
		cashlessThin: (n: number) =>
			`Only ${n} ${n === 1 ? 'receipt names' : 'receipts name'} a payment method. Too few to read a share from.`,

		/* Menu Go */
		menuTitle: 'Places to eat',
		menuCount: (n: number) => `${num(n)} ${n === 1 ? 'place' : 'places'} a surveyor walked into`,
		menuTypical: (v: number) => `A meal here runs to about ${rp(v)}.`,
		menuTypicalThin: (n: number) =>
			`Only ${n} ${n === 1 ? 'place has' : 'places have'} a price written down. That is one warung's price, not the area's.`,
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
		},

		/* The detail view: one record, full size, opened by clicking it. Everything
		   here is a fact the compact card already had room to drop, not a new
		   question asked of the data. */
		detail: {
			close: 'Close',
			paid: (metode: string) => `Paid by ${metode}.`,
			cashlessYes: 'Counted as a cashless payment.',
			cashlessNo: 'Counted as a cash payment.',
			team: (nama: string) => `Recorded by the ${nama} team.`
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
		/* Once the range is measured from a place rather than from the cell centre. The
		   businesses counted really are a different set, so the heading says which. */
		titlePlace: 'When this place is open',
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
		thin: (terbaca: number, usaha: number, r: number) =>
			`Only ${terbaca} of the ${usaha} businesses on record within ${r} m ${terbaca === 1 ? 'publishes' : 'publish'} opening hours. Too few to show how the day goes.`,
		none: (usaha: number, r: number) =>
			`Not one of the ${usaha} ${usaha === 1 ? 'business' : 'businesses'} on record within ${r} m publishes its opening hours.`,

		/* ── The same silences, measured from a place ──────────────────────
		   With no denominator, and that is the honest form. `join-hours.mjs` counted how
		   many businesses stand around a CELL CENTRE and how many of them published
		   hours. Nobody has ever counted either of those from a front door, so these say
		   only what was genuinely counted here: how many readable timetables fall inside
		   the range. Borrowing the cell's denominator would print a fraction whose two
		   halves were measured from two different points. */
		thinPlace: (terbaca: number, r: number) =>
			`Only ${terbaca} ${terbaca === 1 ? 'business' : 'businesses'} within ${r} m of this place ${terbaca === 1 ? 'publishes' : 'publish'} opening hours that can be read. Too few to show how the day goes.`,
		nonePlace: (r: number) =>
			`No business within ${r} m of this place publishes opening hours that can be read.`,
		basisPlace: (terbaca: number, r: number) =>
			`${terbaca} ${terbaca === 1 ? 'business' : 'businesses'} within ${r} m of this place ${terbaca === 1 ? 'publishes' : 'publish'} opening hours that can be read.`,
		failedPlace:
			'The opening hours could not be loaded, so no chart is drawn. Every other figure on this card is unaffected.',

		/* The count names OpenStreetMap on purpose. The sentence at the top of this panel
		   counts the thirteen business types SpotOn scores, from OSM and MAPID together.
		   This one counts every trade OSM has on record, so the two figures differ and a
		   reader is owed the reason they differ. */
		basis: (terbaca: number, usaha: number, r: number) =>
			`${terbaca} of the ${usaha} businesses OpenStreetMap lists within ${r} m publish opening hours that can be read.`,
		refused: (n: number) =>
			`${n} more ${n === 1 ? 'publishes' : 'publish'} them in a form that cannot be read automatically, a public holiday rule for instance.`,
		notFootfall:
			'This counts doors open, not people walking past. The receipts surveyors logged are below, kept separate, because those carry a date and no hour.',
		loading: 'Loading the opening hours…',
		failed: (n: number) =>
			`The opening hours could not be loaded, so no chart is drawn. The count of ${n} businesses below is unaffected.`
	},

	/* ── Stepping inside the model ────────────────────────────────────────────
	   The same rules as the opening-hours panel above, in the shape of a model. The
	   light runs on its own, because Jakarta's sun can be computed. The crowd only
	   moves where the doors were counted, and where they were not that is said
	   plainly rather than covered up with movement for the sake of movement. */
	zoom: {
		open: 'Step into this area',
		openHint: 'See the model through the day',
		title: (name: string) => `A model of ${name} through the day`,
		close: 'Leave the model',
		hourAria: 'The hour on show',
		hourValue: (h: number) => clockHour(h),
		/* The hour on its own, no words around it, for the numerals in the corner. */
		clock: (h: number) => clockHour(h),
		hint: 'Drag to move through the day',
		play: 'Run the day',
		pause: 'Stop',
		now: 'Now',
		nowAria: 'Back to the hour it is in Jakarta',
		/* The model opens close, on the block around the point, and steps out to the
		   whole range. Two steps rather than a free scale: there is close, there is the
		   whole, and there is between. */
		closer: 'Closer',
		farther: 'Further out',
		/* What is printed is always the counted whole hour, never the slider's exact
		   position. Parked at 7.30 it still reports 7am, the counted hour the reader is
		   standing inside. */
		doors: (day: string, h: number, n: number, of: number) =>
			`${day} at ${hour(h)}, ${n} of the ${of} doors counted here are open.`,
		/* Beside the count of open doors, measured against this street's own busiest
		   hour. Somebody dragging the slider is asking whether that count is a lot for
		   here, and a count with nothing to compare it against does not answer that. */
		peakHour: 'This is the hour with the most doors open here.',
		share: (persen: number) => `About ${persen}% of its busiest hour for open doors.`,
		basis: () =>
			"The lit marks are the doors counted open at this hour, each where it stands. The buildings and streets are the basemap's own.",
		/* Four kinds of silence, kept apart. Not one of them is settled by moving the
		   figures around so the screen looks alive. */
		still: (readable: number) =>
			`Only the light moves. ${readable} ${readable === 1 ? 'business' : 'businesses'} here ${readable === 1 ? 'publishes' : 'publish'} opening hours, too few to show how the day goes.`,
		stillNone:
			'Only the light moves. Not one business here publishes its opening hours.',
		/* A similar silence, and not the same claim. Measured from a place, all that was
		   counted is how many published timetables could be READ, so that is all this
		   says. "Not one publishes" would claim to know something nobody counted. */
		stillPlaceNone:
			'Only the light moves. No business within walking range of this place publishes opening hours that can be read.',
		stillLoading: 'Only the light moves until the opening hours have loaded.',
		stillFailed:
			'Only the light moves. The opening hours could not be loaded.',
		stillNodata:
			"Only the light moves. This area's city has not been surveyed, so no competitor or unit is marked on it.",
		sceneLabel: (name: string, h: number, body: string) =>
			`A model of ${name} at ${clockHour(h)}. ${body}`
	},



	mood: {
		busiest: 'at its busiest',
		busy: 'fairly busy',
		quiet: 'a bit quiet',
		empty: 'quiet',
		nodata:
			'This area has not been surveyed yet. Nothing around it has been counted.',
		reading: (n: number, kata: string) =>
			`There are ${n} businesses within walking range here, so it is ${kata}.`,
		/* Labels for the three figures under the model. Deliberately short: these are
		   column names rather than sentences, and in a 21 rem panel each tile gets
		   about 105 px. The long forms are still in `rows` below, for the full list. */
		tiles: {
			around: 'Businesses nearby',
			rivals: 'Rivals of this kind',
			space: 'Units on the market'
		},
		rows: {
			score: 'Opportunity score',
			demand: 'Busyness',
			supply: 'How crowded the trade is',
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
		/* The same heading once the range is measured from a place rather than from the
		   cell centre. What was counted is genuinely a different set, so the heading says
		   which point it was counted from before the reader takes a figure off it. */
		transitPlace: 'What this place reaches',
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
		transitNonePlace: 'No transit node within walking range of this place.',
		/* The stop file could not be loaded. Only reachable with the range measured from
		   a place: measured from a cell the counts are on the grid and survive it, and
		   only the names are lost. An empty list here is a failed request, not a street
		   with nothing on it, and the two must not read alike. */
		transitFailedPlace:
			'The transit nodes could not be loaded, so nothing can be counted from this place yet.',
		transitLoading: 'Checking the transit nodes nearby…',
		transitBand: {
			strongest: 'Transit access here is among the strongest in Jakarta.',
			strong: 'Transit access here is strong.',
			fair: 'Transit access here is fair.',
			thin: 'Transit access here is thin.'
		},
		/* The same sentences, saying whose index it is. Access was computed when the grid
		   was built, from the cell centre, and there is no reading of it taken from a
		   front door. So where the count above it was measured from a place, this has to
		   name the thing it belongs to. Two measurements of different things, printed a
		   line apart with nothing between them, read as two halves of one. */
		transitBandCell: {
			strongest: "The area's transit access is among the strongest in Jakarta.",
			strong: "The area's transit access is strong.",
			fair: "The area's transit access is fair.",
			thin: "The area's transit access is thin."
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
		transitRadiusPlace: (m: number) => `Measured from this place, ${m} m radius`,
		transitShow: 'Show on map',
		transitHide: 'Hide from map',
		/* The competitors, drawn where they actually stand. Shared wording with the
		   transit switch above, because it is the same promise about the same map. */
		rivalsOnMap: 'Competitors on the map',
		rivalsCount: (n: number, cat: string) =>
			`${n} ${cat} drawn where ${n === 1 ? 'it actually stands' : 'they actually stand'}, within the same walking range.`,
		/* Switched off, the sentence above would be describing a map that is not there.
		   Same figure, and it says what to press to see it. */
		rivalsHidden: (n: number, cat: string) =>
			`${n} ${cat} inside the walking range. Show ${n === 1 ? 'it' : 'them'} to see where ${n === 1 ? 'it stands' : 'they stand'}.`,
		rivalsLoading: 'Looking up where they stand…',
		/* Stations are labelled and these are not, so the difference gets a reason. The
		   names exist in the MAPID features, they were simply not kept when the point
		   file was written, and a re-fetch brings them in. */
		rivalsNoNames:
			'None of them carry a name in the data yet, so they are drawn as marks only.',
		rivalsNone: 'No competitors of this type inside the walking range.',
		/* The nearest few, not all of them, and the heading says so. The count above is
		   taken over every competitor captured, named or not. */
		rivalsNearest: 'The nearest ones',
		rivalsMore: (n: number) => `+${n} more nearby`,
		/* Only MAPID carries positions. Saying which source would have them is the
		   difference between a dead end and a fix the reader can act on. */
		rivalsNoPositions:
			'OSM gives competitor counts but not their positions, so there is nothing to draw. Switch the source to MAPID in the legend to see where they are.',
		rivalsFailed: 'Could not load the competitor positions. The counts beside them are unaffected.',
		prov: 'Business points & property: MAPID catalogue. Competitors & transit nodes: OSM.',
		sceneLabel: (nama: string, isi: string) =>
			`A model of ${nama}, built from the basemap. ${isi}`,
		sceneNodata: "This area's city has not been surveyed, so no competitor or unit is marked.",
		sceneBody: (n: number, osm: number, cat: string, unit: number) =>
			`${n} businesses within walking range, ${osm} of them competing ${cat}, and ${unit} units on the market.`,
		/* No business type has been named. The counts are still given because they were
		   genuinely counted; the rivals are not, because rivals of WHAT is precisely the
		   question that has not been asked. */
		sceneNoType: (n: number, unit: number) =>
			`${n} businesses within walking range and ${unit} units on the market.`,
		askForScore:
			'An opportunity score is always for one kind of business. Say what you want to open to see it.'
	},

	/* ── panel ────────────────────────────────────────────────────────────────
	   The area card now leads with one figure per section, and the section in full
	   opens over the panel. What lives here is the short line under each figure,
	   plus the way back out.

	   The row titles are NOT repeated here. Each row wears the title of the section
	   it opens, so what a row promises and what it lands on cannot come apart. */

	panel: {
		back: 'Back',
		backAria: 'Back to the area summary',
		/* Names what is inside rather than saying "see details". A reader is entitled
		   to know what they will find before they press the row. */
		scoreCap: 'How busy, who is here, access, and price',
		scoreAsk: 'Say what you want to open first',
		rivalsCap: (cat: string) => `${cat} within walking range`,
		/* The figure is how many doors are open RIGHT NOW, so the line under it has to
		   say out of how many. Without the denominator that number reads as the whole
		   street, and fewer than one business in six publishes hours at all. */
		hoursNow: (dari: number) => `open now, of ${dari} with published hours`,
		hoursThin: 'Too few published opening hours here',
		/* This is an asking price to buy, per m², and this line is what stops the
		   figure being read as the price of one unit. */
		costCap: (unit: number) => `per m² of land · ${unit} units on the market`,
		costUnits: (unit: number) => `${unit} on the market, no median price`,
		/* Three different silences, and only this one means nobody has looked. */
		costUnread: 'Prices here have not been collected yet',
		costNone: 'Nothing on the market here',
		transitNone: 'None within walking range',
		fieldNone: 'Nobody has recorded anything here',
		loading: 'Loading…',
		failed: 'Could not load'
	},

	/* ── app ──────────────────────────────────────────────────────────────── */

	app: {
		radiusLabel: 'Range',
		radiusValue: (m: number) => `${m} m`,
		radiusAria: 'The walking range being scored',
		radiusHint:
			'How far from the centre counts, for areas and for places alike. Each range carries its own measured price.',
		/* ── flat or standing up ────────────────────────────────────────────────
		   The button is short, the consequence is spelled out in the hint it carries,
		   and the key repeats it once the mode is on. The button does not say "score",
		   because what is coloured is not always a score: with no business type named
		   yet, what this map reads is how busy a place is. */
		viewLabel: 'Map view',
		viewFlat: 'Flat',
		viewRelief: '3D',
		viewFlatHint: 'The map flat, seen straight down.',
		viewReliefHint:
			'The map tips over and every cell stands as tall as the figure its colour shows. Taller means a higher figure. A cell whose city has not been surveyed stays flat, with no height given to it at all.',
		/* Printed in the key rather than on the button, because the key is the one
		   surface whose whole job is to say what this figure is. Height and colour read
		   the same number, so the sentence points back at it. */
		viewReliefNote: 'Height carries the same figure as the colour.',
		/* ── drawn or modelled ─────────────────────────────────────────────────
		   The same basemap, two ways of looking at it. The button is short and the
		   consequence is spelled out in the hint it carries, like the flat-or-3D switch
		   beside it. "Modelled" because that is what is drawn: white masses at the height
		   the map records, streets at their real width, and none of the publisher's
		   lettering. */
		renderLabel: 'Basemap',
		renderDrawn: 'Drawn',
		renderModelled: 'Modelled',
		renderDrawnHint: "The basemap as its publisher draws it, with its street and place names.",
		renderModelledHint:
			"The same basemap's buildings, streets, water and parks, modelled the way the area model is. Each building stands at the height the map records, and one without a recorded height stands at one uniform height.",
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
			`${n} cells are not covered by ${src} data for ${cat}, so they are unscored. Nobody has counted the competitors there`,
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
		/* The mark on the model: what it is built from, or why it is not here yet. Four
		   states, one mark, so none of them has to be guessed from an empty disc. */
		model: {
			ready: 'buildings and streets from the basemap',
			reading: 'reading the basemap…',
			failed: 'the basemap could not be read',
			none: 'this basemap has no geometry to model'
		},
		fullNumbers: 'See the full figures',
		/* The map's own badge, pinned to the selected cell. Deliberately the count and
		   nothing else: the breakdown is in the panel, what the map has to carry is
		   "how many". */
		mapStops: (n: number) => `${n} transit ${n === 1 ? 'node' : 'nodes'}`,
		mapStopsAria: (n: number, r: number) =>
			`${n} transit ${n === 1 ? 'node' : 'nodes'} within a ${r} m walk of this cell`,
		/* Used once the range ring is drawn around a place rather than around the cell
		   centre. A label saying "of this cell" over a range measured from a front door
		   would be the one reading on this map a reader cannot check for themselves. */
		mapStopsAriaPlace: (n: number, r: number) =>
			`${n} transit ${n === 1 ? 'node' : 'nodes'} within a ${r} m walk of the selected place`,
		/* The number of competitor dots actually drawn, not the panel's figure. The
		   badge and the map it sits on must never disagree. */
		mapRivals: (n: number) => `${n} ${n === 1 ? 'competitor' : 'competitors'}`,
		mapRivalsAria: (n: number, r: number) =>
			`${n} similar ${n === 1 ? 'business' : 'businesses'} within a ${r} m walk of this cell`,
		mapRivalsAriaPlace: (n: number, r: number) =>
			`${n} similar ${n === 1 ? 'business' : 'businesses'} within a ${r} m walk of the selected place`,
		mapReach: (r: number) => `${r} m reach`,
		tipNodata: 'City not surveyed yet · survey priority candidate',
		tipScore: (cat: string) => `${cat} score`,
		tipBusy: (n: number) => `${n} businesses nearby`,
		tipRivals: (n: number) => `${n} competitors`,
		tipUnits: (n: number) => `${n} units listed`,
		/* This line used to read "MAPID + OSM, r=800 m". Both halves were shorthand only
		   somebody who already knew could read: `r` is the radius, and the source is
		   already named in the legend open on the same screen. What is left is the one
		   thing worth being reminded of while pointing at a cell, which is how far out
		   the counting went. */
		tipRadius: (m: number) => `within an ${m} m walk`,
		sheet: 'Information panel',
		sheetGrip: 'Resize panel'
	},

	tapak: {
		/* This used to quote two numbers: how many cells, then how many of them have
		   data. Since both surveys are read together the two are the same number, and
		   the sentence read "562 cells, and 562 of them have data". */
		/* The salutation follows the reader's clock, the figure still comes from the
		   grid. The part of the day and the choice of wording arrive as positions
		   rather than as a finished phrase, so switching language changes the words
		   and not which greeting is being said. */
		greet: (total: number, part: DayPart, wording: number) =>
			`${SALUTE[part][wording]} I'm Tapak. I've been round ${total} cells near the MRT, KRL, LRT and TransJakarta corridors. What are you thinking of opening?`,
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
		/* The follow-up people actually type, offered once so it is visible that the
		   box below can be talked to. Only one: everything else is typed, and what
		   reads it is the understanding layer rather than a list of phrasings here. */
		why: (name: string) => `Why ${name}?`,
		retry: 'Try again',
		/* Said by Tapak inside the thread, separately from the notice over the map. The
		   question was never sent, so the turn still has to answer something rather than
		   sitting on "one moment" for good. */
		outOfQuota: 'There are no questions left this week, so I cannot answer this one.',
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
		/* ── Why that one ──────────────────────────────────────────────────
		   The follow-up people actually ask, and the one that used to come back as
		   the identical list read out a second time. Built from clauses rather than
		   one template because half of them are conditional: an area with nothing on
		   the market must not say "0 units on the market, median ·".

		   Every figure is computed by the scoring engine. Not one is written by the
		   model. */
		explainWhich:
			'Which area? Name it and I will break its score down from the figures I have.',
		explain: {
			unscored: (name: string, cat: string, simpul: number, radius: number) =>
				`${name} has not been surveyed for ${cat}, so I have not scored it at all. The only thing measured there is its access: ${num(simpul)} ${simpul === 1 ? 'transit node' : 'transit nodes'} within ${radius} m.`,
			/* A question naming a figure is answered with that figure first, not with the
			   score. It was not, so "what is the rent at Pusdiklat BPS" came back as a
			   score breakdown with the price fourth in it. */
			/* Worded so the count never has to agree with the measure's own name. Those
			   names are a mix of singular and plural noun phrases, so "the businesses
			   nearby is 75" is one template away at all times. */
			measure: (name: string, ukuran: string, nilai: string) =>
				`${name} comes in at ${nilai} on ${ukuran}.`,
			measureNone: (name: string, ukuran: string) =>
				`${name} has no reading at all for ${ukuran}, so there is nothing I can quote you. Not zero, just never measured.`,
			/* Where it sits on the grid, because that is what somebody asking "is that
			   cheap" wants to know. The figure alone does not answer it. */
			priceRank: (peringkat: number) =>
				`That is dearer than ${peringkat}% of the grid, so it sits below most of it.`,
			priceIsSale:
				'It is an asking price to buy, not a monthly rent. The property catalogue publishes no rentals for Jakarta at all, so there is no rent figure for me to give you.',
			scoreAside: (nilai: string, cat: string) =>
				`Its opportunity score is ${nilai} out of 100 for ${cat}.`,
			lead: (name: string, cat: string, nilai: string) =>
				`${name} scores ${nilai} out of 100 for ${cat}, and here is what that is made of.`,
			/* Every count here has to agree with the noun beside it, which is this
			   language's job and not the engine's. Indonesian does not inflect and its
			   version of these is one sentence each. A catchment with one rival in range
			   is not rare, and "1 pharmacies already stand" is the kind of seam that makes
			   a sentence read as generated rather than written. Where the singular would
			   need the noun in a form this is not given, it drops the noun instead: the
			   lead sentence above has already named the trade. */
			crowd: (usaha: number, radius: number, nilai: string) =>
				usaha === 1
					? `There is one other business within ${radius} m, which puts the trade around it at ${nilai} out of 100.`
					: `There are ${num(usaha)} other businesses within ${radius} m, which puts the trade around it at ${nilai} out of 100.`,
			rivals: (n: number, cat: string, nilai: string) =>
				n === 1
					? `One is already in the same range, so competition reads ${nilai} out of 100.`
					: `${num(n)} ${cat} already stand in the same range, so competition reads ${nilai} out of 100.`,
			rivalsNone: (cat: string) =>
				`There are no ${cat} in that range at all, so nothing is taken off for competition.`,
			space: (n: number, harga: string) =>
				n === 1
					? `One commercial unit is on the market around it, asking ${harga}.`
					: `${num(n)} commercial units are on the market around it, at a median of ${harga}.`,
			spaceUnpriced: (n: number) =>
				n === 1
					? 'One commercial unit is on the market around it, and it does not list a price.'
					: `${num(n)} commercial units are on the market around it, but not one of them lists a price.`,
			spaceNone: 'Nothing commercial is on the market around it.',
			/* A position on the price ladder, not a verdict. The same figure the score
			   breakdown prints, because two places saying the same thing have to say it
			   with the same number. */
			costHeld: (peringkat: number) =>
				`Space there is dearer than in ${peringkat}% of the grid, and that holds the score back.`,
			transit: (n: number) =>
				n === 1
					? 'One transit node is within walking range.'
					: `${num(n)} transit nodes are within walking range.`
		},
		remarkUncovered: (name: string, cat: string) =>
			`${name} has not been surveyed yet, so the ${cat} around it have never been counted. I have no figure to give you for it.`,
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
		/* This read "About the area", which was right while everything under it was
		   measured from the cell centre. The walking range is measured from this front
		   door now, so the heading names the point it is measured from and the line under
		   it names the figures that stay the area's. */
		cardArea: 'Around this place',
		cardAreaNote:
			'The walking range is measured from this place. The opportunity score, how busy it is, the competitor count that score used, the access index and the median asking price stay the area\'s, counted from the cell centre when the grid was built.',
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
		/* Read when the answer is one area rather than a ranking. Without it a reply to
		   "why that one" looks exactly like a ranking that happened to come back short. */
		explain: 'one area, broken down',
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

	/* Accounts, plans and what is left of them. Not one allowance is written here:
	   every sentence below takes its figures as arguments and they all come from
	   `domain/plans`, so raising a tier changes the pricing page, the account card
	   and the sentence somebody reads when they run out, in one edit. */
	account: {
		title: 'Account',
		sub: 'The plan you are on, what is left of it, and how to add more.',
		pageTitle: 'SpotOn · Account and plans',
		signinTitle: 'SpotOn · Sign in',
		chip: 'Account and remaining quota',
		chipLeft: (ai: number, areas: number) => `${num(ai)} questions and ${num(areas)} areas left`,
		back: 'Back to the map',

		signIn: 'Sign in',
		signOut: 'Sign out',
		signUp: 'Create an account',
		signInHead: 'Sign in to SpotOn',
		signInSub: 'One account holds your question quota and your area quota.',
		signUpHead: 'Create a SpotOn account',
		signUpSub: 'You start on the Free plan. No card is asked for.',
		toSignUp: 'No account yet? Create one.',
		toSignIn: 'Already have an account? Sign in.',
		email: 'Email address',
		password: 'Password',
		name: 'What to call you',
		nameOptional: 'can be left blank',
		passwordHint: (min: number) => `At least ${min} characters.`,
		working: 'One moment…',

		/* ── the two pages that are genuinely slow ─────────────────────────────────
		   The map fetches its grid before it can colour a single cell, and the account
		   page reads that same grid on the server and projects all 562 catchments. Only
		   those two are slow enough to be worth drawing the outline of first, and only
		   those two are named here. */
		openingMap: 'Getting the map ready',
		openingAccount: 'Getting your account page ready',

		/* ── two waits, not one ────────────────────────────────────────────────────
		   Signing in is two stages and only the first is quick: the address and the
		   password go out and come back, and then the destination loads, which is the
		   long half. Each is said from where the work actually is rather than off a
		   countdown, and neither is a percentage, which is the rule Tapak's own answer
		   stream already follows. */
		checking: 'Checking your account',
		making: 'Setting your account up',

		demoHead: 'Demo mode',
		demoEnter: 'Continue on the demo account',
		demoWhy:
			'No database is configured, so SpotOn runs on a single example account. Quotas, plans and purchases all behave exactly as they really do, they are just held in the server memory and go when the server stops.',
		demoBadge: 'Demo account',
		demoNote: 'This account is not stored anywhere. What is on it goes when the server stops.',

		errors: {
			credentials: 'That email and password do not match.',
			taken: 'That address already belongs to an account.',
			invalid: 'Something is missing, or the password is too short.',
			unavailable: 'The database could not be reached. Try again shortly.',
			signedout: 'Your session has ended. Sign in again.'
		},

		/* Both drawings on this page read real figures off the grid on disk rather than
		   being decoration shaped like data. The numbers arrive as arguments, so a
		   rebuilt grid moves the sentences with it. What is coloured is TRADE, not an
		   opportunity score: nobody choosing a plan has named a business type, and an
		   opportunity score without one is a score for a business they never mentioned. */
		modelLabel: 'A model of the hexagon grid: each column stands as tall as the trade around one catchment.',
		modelMark: 'a model, not a map',
		fieldTitle: 'The areas you can open',
		fieldLead: (cells: number) => `${num(cells)} catchments, each where it really is.`,
		fieldNote: (unread: number) =>
			unread === 0
				? 'Coloured by the trade standing around each one, which is what the map paints before any business type has been named.'
				: `Coloured by the trade standing around each one, which is what the map paints before any business type has been named. ${num(unread)} catchments sit in cities the catalogue has never read, and those are drawn empty rather than quiet.`,
		fieldLabel: (cells: number, read: number) =>
			`A map of ${num(cells)} catchments, ${num(read)} of them with their trade counted.`,
		fieldLow: 'quiet',
		fieldHigh: 'busiest',
		fieldNoData: 'not in the catalogue',

		plans: 'Plans',
		plan: {
			free: {
				name: 'Free',
				blurb: 'Enough to try it. Ask two or three things, then open the places the answers name.'
			},
			personal: {
				name: 'Personal',
				blurb:
					'For one person working through a shortlist, with the room to open everything that comes back.'
			},
			premier: {
				name: 'Premier',
				blurb: 'For a team, or for one person surveying the whole grid inside a week.'
			}
		},
		priceFree: 'No charge',
		/* Written in full rather than shortened to "Rp 79k". `rp` is for property prices
		   twelve digits long, which stop being read as quantities at all. This is a figure
		   somebody is about to be charged, and a figure being charged is written out. */
		priceMonth: (v: number) => `Rp ${num(v)} a month`,
		grantAi: (n: number) => `${num(n)} questions a week`,
		grantAnalysis: (n: number) => `${num(n)} areas or places a week`,
		currentPlan: 'Current plan',
		choosePlan: 'Move to this plan',
		planNote:
			'A change of plan takes effect at once and the week starts again from nothing. What is left of the week you are in does not come across, and anything bought outright is untouched.',

		balance: 'What is left',
		meter: {
			ai: 'Questions for Tapak',
			analysis: 'Areas and places'
		},
		meterNote: {
			ai: 'One each time you ask, answered or not. What is paid for is the call out to the language model, and that call happens whether or not anything useful comes back.',
			analysis:
				'One each time you open an area or a unit yourself. Closing the card costs nothing, reopening what is already open costs nothing, and an area Tapak opens for you is not charged at all.'
		},
		weekLeft: (leftOver: number, week: number) => `${num(leftOver)} of ${num(week)} left this week`,
		extraLeft: (n: number) => `${num(n)} bought outright, and they do not expire`,
		/* Written in Jakarta time rather than in the reader's own. The boundary really is
		   midnight on Monday in Jakarta, so read from another zone the same instant falls
		   on a Sunday, and this sentence would name a Sunday while everything else about
		   the product names a Monday. */
		refillOn: (at: number) =>
			`Refills on ${new Date(at).toLocaleDateString('en-GB', { timeZone: JAKARTA, weekday: 'long', day: 'numeric', month: 'long' })}.`,

		/* The day names come from the date itself through `Intl` rather than from a list
		   of seven words written here. Two reasons: a list has to be written once per
		   language, and it is easy to get one box out of order without anybody noticing.
		   Jakarta, like the refill sentence above, because the boundary is one instant and
		   read from another zone it falls on a different day. */
		/* Set after the large figure, because that figure is the total while the bar
		   under it is this week's allowance alone. One word makes the number describe
		   itself, so nobody has to guess what "160" is out of. */
		leftSuffix: 'left',
		weekTitle: 'This week',
		weekdayNarrow: (at: number) =>
			new Date(at).toLocaleDateString('en-GB', { timeZone: JAKARTA, weekday: 'narrow' }),
		weekdayLong: (at: number) =>
			new Date(at).toLocaleDateString('en-GB', { timeZone: JAKARTA, weekday: 'long' }),
		today: 'today',
		count: (n: number) => num(n),

		packs: 'Top-ups, bought once',
		packsNote:
			'For a week that needs more than the plan grants. What is bought here is not swept away on Monday.',
		pack: {
			ai_pack: (n: number) => `${num(n)} questions`,
			analysis_pack: (n: number) => `${num(n)} areas or places`
		},
		buy: (v: number) => `Buy for Rp ${num(v)}`,
		noPayment:
			'There is no payment behind any of these buttons. Everything that follows a payment is real, so the plan genuinely moves and the quota genuinely grows.',

		outOf: {
			ai: 'No questions left this week',
			analysis: 'No area readings left this week'
		},
		outOfNote: {
			ai: 'Tapak cannot answer again until the quota refills or the plan goes up.',
			analysis: 'Areas and units cannot be opened again until the quota refills or the plan goes up.'
		},
		/* ── leaving ───────────────────────────────────────────────────────────────
		   The button used to stand alone at the foot of the page with nothing saying
		   what pressing it would cost. What it costs is the session and nothing else,
		   and the one control here that ends something should name what it ends. */
		sessionTitle: 'Session',
		signOutNote:
			'Signing out only closes the session in this browser. The account, the plan and what is left on it all stay as they are.',
		signingOut: 'Closing your session',

		signedOut: 'Your session has ended',
		signedOutNote: 'Sign in again to carry on. What is already on the screen stays readable.',
		seePlans: 'See the plans',
		dismiss: 'Close'
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
