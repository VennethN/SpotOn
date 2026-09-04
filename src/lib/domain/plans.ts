import type { Allowance, Balance, MeterKey, PackKey, PlanKey } from '$lib/types';

/**
 * What each tier grants, and the arithmetic of spending it.
 *
 * Pure, like everything else in this directory: no database, no clock of its own, no
 * Svelte. Every function here is handed the moment it should reckon from, so the same
 * arithmetic runs on the server against a stored record and in the browser against the
 * copy the page was given, and the two cannot come to disagree about how much is left.
 *
 * The numbers below are the only place the allowances are written. Nothing in the copy
 * types one out: `i18n` takes them as arguments, so raising a tier here raises it on
 * the pricing page, on the account page and in the sentence Tapak says when somebody
 * runs out, in one edit.
 */

/**
 * The three tiers, in the order they are offered.
 *
 * `free` is a plan and not a trial. It never expires and it refills on the same Monday
 * the paid tiers do, because a free tier that quietly stops working is a paid tier with
 * a longer sign-up form.
 */
export const PLAN_KEYS: PlanKey[] = ['free', 'personal', 'premier'];

export interface Plan {
	key: PlanKey;
	/** What one week grants, per meter. */
	week: Record<MeterKey, number>;
	/**
	 * Rupiah per MONTH, while the allowance above is per WEEK.
	 *
	 * The two periods are deliberately different. Billing monthly is what everyone
	 * already expects from a subscription, and metering weekly is what keeps a heavy
	 * week from eating a month: an account that spends its questions on a Tuesday is
	 * working again on Monday rather than sitting idle until the invoice turns over.
	 */
	price: number;
}

export const PLANS: Record<PlanKey, Plan> = {
	free: {
		key: 'free',
		/* Enough to answer a real question and look at what the answer named. Somebody
		   trying SpotOn on a lunch break asks two or three things and opens the places
		   that come back, and this covers that without a card. */
		week: { ai: 5, analysis: 15 },
		price: 0
	},
	personal: {
		key: 'personal',
		/* One person working through a shortlist: several questions a day, and the room
		   to open everything each one names rather than choosing which ones to look at. */
		week: { ai: 60, analysis: 300 },
		price: 79_000
	},
	premier: {
		key: 'premier',
		/* A team, or one person surveying the whole grid. 562 catchments is the whole of
		   it, and this clears that in a week with room to go back over the shortlist. */
		week: { ai: 250, analysis: 1_500 },
		price: 249_000
	}
};

/**
 * The one-off top-ups, for the week somebody needs more than their tier grants.
 *
 * Bought outright rather than subscribed to, and they do not expire. That is the whole
 * difference from a plan, and it is why they are stored in their own pot: a credit
 * somebody paid for on its own must not be swept away by a Monday.
 */
export const PACK_KEYS: PackKey[] = ['ai_pack', 'analysis_pack'];

export interface Pack {
	key: PackKey;
	meter: MeterKey;
	amount: number;
	/** Rupiah, once. */
	price: number;
}

export const PACKS: Record<PackKey, Pack> = {
	ai_pack: { key: 'ai_pack', meter: 'ai', amount: 50, price: 49_000 },
	analysis_pack: { key: 'analysis_pack', meter: 'analysis', amount: 300, price: 39_000 }
};

export const METER_KEYS: MeterKey[] = ['ai', 'analysis'];

export function isPlanKey(v: unknown): v is PlanKey {
	return typeof v === 'string' && v in PLANS;
}

export function isPackKey(v: unknown): v is PackKey {
	return typeof v === 'string' && v in PACKS;
}

const DAY_MS = 86_400_000;

/**
 * Jakarta, in milliseconds off UTC.
 *
 * A constant rather than a lookup because it genuinely is one: Western Indonesian Time
 * is UTC+7 all year and has no daylight saving to move it. The week has to turn at a
 * fixed hour somewhere, and the only defensible somewhere for a product about Jakarta
 * is Jakarta. Reckoning in the server's own zone would move the boundary with whichever
 * region the deploy landed in, and a reader's allowance would refill at a different
 * hour after every migration.
 */
const WIB_MS = 7 * 60 * 60 * 1000;

/**
 * The Monday 00:00 in Jakarta that the given moment falls on or after, as an epoch.
 *
 * The epoch itself was a Thursday, which is the only reason the 3 is there: shifted by
 * three days, day zero lands on a Monday and the remainder is how far into the week
 * this moment is.
 */
export function weekStart(now: number): number {
	const day = Math.floor((now + WIB_MS) / DAY_MS);
	return (day - ((day + 3) % 7)) * DAY_MS - WIB_MS;
}

/** A week's worth of one plan, unspent, keeping whatever was bought outright. */
function grant(plan: PlanKey, meter: MeterKey, extra = 0): Balance {
	const week = PLANS[plan].week[meter];
	return { week, weekLeft: week, extra };
}

/** A brand new account's standing: this week's allowance, nothing bought, nothing spent. */
export function freshAllowance(plan: PlanKey, now: number): Allowance {
	return {
		plan,
		weekStart: weekStart(now),
		meters: { ai: grant(plan, 'ai'), analysis: grant(plan, 'analysis') }
	};
}

/**
 * The allowance brought up to date, given the moment it is being read at.
 *
 * ONE week's allowance, however long the account was quiet. An account that has not
 * been touched since March comes back to this week, not to the nineteen it slept
 * through, because an allowance is a rate and not a debt somebody is owed.
 *
 * What is bought outright survives the rollover untouched. It was paid for on its own
 * and the Monday has no claim on it.
 *
 * Returns the same object when nothing has moved, so a caller can use identity to
 * decide whether there is anything to write back.
 */
export function refill(allowance: Allowance, now: number): Allowance {
	const start = weekStart(now);
	if (start === allowance.weekStart) return allowance;
	return {
		plan: allowance.plan,
		weekStart: start,
		meters: {
			ai: grant(allowance.plan, 'ai', allowance.meters.ai.extra),
			analysis: grant(allowance.plan, 'analysis', allowance.meters.analysis.extra)
		}
	};
}

/** What is left on one meter, both pots together. This is the figure a reader is shown. */
export function left(allowance: Allowance, meter: MeterKey): number {
	const b = allowance.meters[meter];
	return b.weekLeft + b.extra;
}

/**
 * One unit off one meter.
 *
 * The weekly pot goes first and the bought credits are only touched once it is empty.
 * Spending the bought ones first would throw away credits somebody paid for in order to
 * preserve credits that were about to be replaced for nothing on Monday.
 *
 * Refuses rather than going negative, and says so in the same shape it says yes, so no
 * caller can read a refusal as a spend that happened to cost nothing.
 */
export function spend(
	allowance: Allowance,
	meter: MeterKey,
	now: number
): { ok: boolean; allowance: Allowance } {
	const current = refill(allowance, now);
	const b = current.meters[meter];
	if (b.weekLeft <= 0 && b.extra <= 0) return { ok: false, allowance: current };

	const next: Balance =
		b.weekLeft > 0
			? { ...b, weekLeft: b.weekLeft - 1 }
			: { ...b, extra: b.extra - 1 };
	return {
		ok: true,
		allowance: { ...current, meters: { ...current.meters, [meter]: next } }
	};
}

/**
 * Move an account onto another tier, now.
 *
 * The new tier's week starts immediately and unspent credits from the old one do not
 * come along. Upgrading mid-week therefore hands over the whole new allowance rather
 * than a slice of it, which is the reading that cannot leave somebody worse off for
 * having paid: carrying the remainder across would mean an account that had spent its
 * five free questions upgraded into a tier with fifty five.
 *
 * A downgrade lands the same way and can shrink what is left. It is the reader's own
 * choice, made from a page that prints both allowances side by side.
 *
 * What was bought outright is untouched. It belongs to the account, not to the tier.
 */
export function setPlan(allowance: Allowance, plan: PlanKey, now: number): Allowance {
	return {
		plan,
		weekStart: weekStart(now),
		meters: {
			ai: grant(plan, 'ai', allowance.meters.ai.extra),
			analysis: grant(plan, 'analysis', allowance.meters.analysis.extra)
		}
	};
}

/** A bought pack added to the pot that does not expire. */
export function addPack(allowance: Allowance, pack: PackKey, now: number): Allowance {
	const { meter, amount } = PACKS[pack];
	const current = refill(allowance, now);
	const b = current.meters[meter];
	return {
		...current,
		meters: { ...current.meters, [meter]: { ...b, extra: b.extra + amount } }
	};
}
