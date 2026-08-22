import type { FieldStats } from '$lib/types';

/**
 * The field records themselves: receipts, eateries, premises, and notes about a street.
 *
 * The grid keeps the COUNTS — `join-missions.mjs` wrote those onto every cell that has
 * any — because that is all a ranking needs. It is not what somebody choosing a corner
 * wants to read. "Twelve receipts were recorded here" and "somebody paid by QRIS at
 * Nasi Uduk Bu May on 20 August, and the queue at the warung across the road was more
 * than three deep" are the same fact at two different distances from a decision, and
 * only the second one can be argued with.
 *
 * So the records are loaded separately (`static/data/field.json`, written by
 * `scripts/build-field.mjs` from the very same file `join-missions.mjs` counted) and
 * matched back to a cell here, on demand, one cell at a time. This mirrors
 * `domain/transit`, `domain/competitors` and `domain/premises` exactly, for the same
 * reason and by the same route.
 *
 * MEMBERSHIP IS NOT RECOMPUTED HERE, AND THAT IS THE DIFFERENCE
 *
 * Those three modules re-run the distance test in the browser, because their points are
 * catalogues and a catchment is whatever falls inside the radius the reader has chosen.
 * These records were assigned a home cell at build time, by `scripts/lib/home-cell.mjs`,
 * and they keep it: each one belongs to exactly one catchment and appears in exactly one
 * list. Recomputing membership against the reader's radius would put the same receipt in
 * five cards and make the count above each list wrong in a way nothing could catch.
 *
 * The distance is carried on the record anyway, so the card can say how far away it was.
 *
 * WHAT THESE RECORDS ARE NOT
 *
 * They are not a survey of Jakarta. 191 of 562 cells have one, and the map has no way
 * of knowing whether the other 371 are quiet or simply unvisited. Nothing here is
 * averaged into a score, and every label the reader sees says RECORDED rather than
 * naming the thing itself: "receipts recorded", not "spending".
 */

/** Which survey a record came from. */
export type FieldKind = 'struk' | 'menu' | 'properti' | 'catatan';

export const FIELD_KINDS: readonly FieldKind[] = ['struk', 'menu', 'properti', 'catatan'];

/** How busy the surveyor found the place, in their own three options. */
export type Crowd = 'sepi' | 'sedang' | 'ramai';

/** Sale or rent, as the property form asks it. */
export type Offer = 'jual' | 'sewa';

/**
 * One record, whatever survey it came from.
 *
 * One shape with optional halves rather than a union of four, because every surface
 * that touches these treats them as one list sorted by distance — the card, the map
 * layer, the count. A union would be four branches at every one of those to reach the
 * two fields they all share.
 */
export interface FieldRecord {
	/** The catchment this belongs to, decided at build time and not re-decided here. */
	cell: string;
	kind: FieldKind;
	lat: number;
	lon: number;
	/** Metres from the cell centre. */
	distance: number;
	/** The place, as the surveyor wrote it down. Absent on a community note. */
	place: string | null;
	/** The kind of place, or the kind of property. */
	sort: string | null;
	/** The day it was recorded, `YYYY-MM-DD`. */
	date: string | null;
	photo: string | null;

	/* Struk Go */
	pay: string | null;
	/** Whether that method was cashless. Null for one nobody has classified. */
	cashless: boolean | null;

	/* Menu Go */
	dish: string | null;
	/** What the place charges on average, rupiah, exactly as written down. */
	price: number | null;
	crowd: Crowd | null;

	/* Properti Go */
	offer: Offer | null;
	address: string | null;

	/* Catatan warga */
	title: string | null;
	body: string | null;
	by: string | null;
	community: string | null;
}

/** The on-disk shape. Named keys rather than a tuple — see `scripts/build-field.mjs`. */
interface RawRecord {
	cell: string;
	m: FieldKind;
	lat: number;
	lon: number;
	d: number;
	place?: string;
	kind?: string;
	date?: string;
	photo?: string;
	pay?: string;
	cashless?: boolean;
	dish?: string;
	price?: number;
	crowd?: Crowd;
	offer?: Offer;
	address?: string;
	title?: string | null;
	body?: string | null;
	by?: string;
	community?: string;
}

export interface FieldFile {
	meta: {
		source: string;
		records: number;
		cells: number;
		outside: number;
		byMission: Record<string, number>;
	};
	records: RawRecord[];
}

/**
 * Reads the file into records grouped by cell.
 *
 * Grouped once here rather than filtered per selection: the card asks for one cell at a
 * time and would otherwise walk all 709 records on every click, and the grouping is the
 * same every time.
 */
export function parseField(file: FieldFile): Map<string, FieldRecord[]> {
	const out = new Map<string, FieldRecord[]>();
	for (const r of file.records ?? []) {
		const rec: FieldRecord = {
			cell: r.cell,
			kind: r.m,
			lat: r.lat,
			lon: r.lon,
			distance: r.d,
			place: r.place ?? null,
			sort: r.kind ?? null,
			date: r.date ?? null,
			photo: r.photo ?? null,
			pay: r.pay ?? null,
			cashless: typeof r.cashless === 'boolean' ? r.cashless : null,
			dish: r.dish ?? null,
			price: typeof r.price === 'number' ? r.price : null,
			crowd: r.crowd ?? null,
			offer: r.offer ?? null,
			address: r.address ?? null,
			title: r.title ?? null,
			body: r.body ?? null,
			by: r.by ?? null,
			community: r.community ?? null
		};
		const list = out.get(rec.cell);
		if (list) list.push(rec);
		else out.set(rec.cell, [rec]);
	}
	return out;
}

/** One cell's records of one survey, nearest first. The file is already in that
    order, so this is a filter and not a second sort. */
export const ofKind = (records: readonly FieldRecord[], kind: FieldKind): FieldRecord[] =>
	records.filter((r) => r.kind === kind);

/**
 * The surveys a cell has anything from, in the order the interface shows them.
 *
 * Receipts first, then eateries, then premises, then what people wrote about the
 * street: that runs from the hardest evidence to the softest, which is the order a
 * reader should meet them in.
 */
export function kindsPresent(stats: FieldStats | null): FieldKind[] {
	if (!stats) return [];
	return FIELD_KINDS.filter((k) => stats[k] > 0);
}

/** Everything recorded here, of every kind. Null-safe so a caller can hand it a cell
    nobody surveyed without checking first. */
export const totalRecorded = (stats: FieldStats | null): number =>
	stats ? stats.struk + stats.menu + stats.properti + stats.catatan : 0;

/**
 * How the receipts here were paid for, most common first.
 *
 * Read off the records rather than off a stored breakdown, because a breakdown per
 * method would be four more columns on every cell to answer a question only the open
 * card asks. Methods nobody wrote down are left out entirely.
 */
export function payMethods(records: readonly FieldRecord[]): Array<{ pay: string; n: number }> {
	const counts = new Map<string, number>();
	for (const r of ofKind(records, 'struk')) {
		if (!r.pay) continue;
		counts.set(r.pay, (counts.get(r.pay) ?? 0) + 1);
	}
	return [...counts]
		.map(([pay, n]) => ({ pay, n }))
		.sort((a, b) => b.n - a.n || a.pay.localeCompare(b.pay));
}

/** The eateries here that carry a price, cheapest first. Ones with no price are left
    out of the list and counted by `withoutPrice`, exactly as the property panel does. */
export const pricedMenus = (records: readonly FieldRecord[]): FieldRecord[] =>
	ofKind(records, 'menu')
		.filter((r) => r.price !== null)
		.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

/** Eateries recorded here with no price written down. Stated rather than hidden: it is
    the difference between the count above the list and the length of it. */
export const menusWithoutPrice = (records: readonly FieldRecord[]): number =>
	ofKind(records, 'menu').filter((r) => r.price === null).length;

/** The premises recorded here, the ones offered for rent first. That is the half this
    product has never been able to show, so it leads. */
export const premisesRecorded = (records: readonly FieldRecord[]): FieldRecord[] =>
	ofKind(records, 'properti').sort(
		(a, b) => Number(b.offer === 'sewa') - Number(a.offer === 'sewa') || a.distance - b.distance
	);

/** The most recent day anything was recorded here. Null when no record carries a date. */
export function lastRecorded(records: readonly FieldRecord[]): string | null {
	let best: string | null = null;
	for (const r of records) {
		if (!r.date) continue;
		if (best === null || r.date > best) best = r.date;
	}
	return best;
}
