/**
 * Self-test: the meters, against the plan table actually in the repository. No network,
 * no database.
 *
 *   node scripts/selftest-plans.mjs
 *
 * WHY THIS FILE EXISTS
 *
 * Because the arithmetic in `domain/plans` is the only thing in the product that decides
 * whether somebody gets what they paid for, and its failures are all silent. A week that
 * turns at the wrong hour, an allowance that stacks up over a quiet month, a top-up
 * swept away by a Monday, a spend that empties the bought pot before the free one: not
 * one of those raises anything. They come back as a balance that is quietly wrong, and
 * the reader has no way to check it because the meter is the only record.
 *
 * The same functions run on both sides of the network. The server spends against a
 * stored record, the browser spends against the copy the page was given, and the figure
 * on screen is only honest for as long as the two agree. So this checks the rules, not
 * one caller's use of them.
 *
 * The numbers are read from `PLANS` and `PACKS` rather than written here. A test that
 * hard-codes 5 and 15 is a second place the allowances live, and the day somebody raises
 * a tier it fails for the wrong reason.
 */

import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = new URL('..', import.meta.url);

async function load() {
	const server = await createServer({
		configFile: false,
		root: fileURLToPath(ROOT),
		resolve: { alias: { $lib: fileURLToPath(new URL('src/lib', ROOT)) } },
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'error'
	});
	const plans = await server.ssrLoadModule('/src/lib/domain/plans.ts');
	await server.close();
	return plans;
}

const P = await load();
const { PLANS, PLAN_KEYS, PACKS, PACK_KEYS, METER_KEYS } = P;

let failures = 0;
const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : `\n         ${detail}`}`);
};

console.log('Plans and meters self-test (no network)\n');

/* A moment somewhere inside a known week, in Jakarta. Passed in rather than read from
   the clock: a test that reads the clock passes on a Tuesday and fails on a Sunday, and
   the whole point of `weekStart` taking its moment as an argument is that nothing here
   has to know what day it is. */
const DAY = 86_400_000;
const WIB = 7 * 60 * 60 * 1000;
/** Wednesday 20 August 2025, 10:00 in Jakarta. */
const WED = Date.UTC(2025, 7, 20, 3, 0, 0);

console.log('The week turns on Monday, in Jakarta');
{
	const start = P.weekStart(WED);
	const asJakarta = new Date(start + WIB);
	check(
		'the week containing a Wednesday starts on a Monday',
		asJakarta.getUTCDay() === 1,
		`got day ${asJakarta.getUTCDay()} (0 = Sunday)`
	);
	check(
		'and it starts at midnight Jakarta time',
		asJakarta.getUTCHours() === 0 && asJakarta.getUTCMinutes() === 0,
		`got ${asJakarta.toISOString()}`
	);
	check('and that Monday is 18 August 2025', asJakarta.getUTCDate() === 18);

	/* The boundary itself, from both sides. A minute before Monday midnight belongs to
	   the week before, and the instant of it belongs to the new one. Off by an hour, this
	   is where the mistake shows: with the server's own zone instead of Jakarta's, the
	   two readings below land in the same week. */
	const monday = P.weekStart(WED);
	check('one minute before the boundary is the previous week', P.weekStart(monday - 60_000) === monday - 7 * DAY);
	check('the boundary itself is the new week', P.weekStart(monday) === monday);
	check('and every moment inside one week reads the same start', P.weekStart(monday + 6 * DAY + 23 * 3600_000) === monday);
}

console.log('\nA new account gets one week of its plan');
for (const key of PLAN_KEYS) {
	const a = P.freshAllowance(key, WED);
	const ok = METER_KEYS.every(
		(m) => a.meters[m].week === PLANS[key].week[m] && a.meters[m].weekLeft === PLANS[key].week[m]
	);
	check(`${key} opens on its own allowance, unspent`, ok, JSON.stringify(a.meters));
	check(`${key} opens with nothing bought outright`, METER_KEYS.every((m) => a.meters[m].extra === 0));
}

console.log('\nSpending takes the weekly pot first, then what was bought');
{
	let a = P.freshAllowance('free', WED);
	a = P.addPack(a, 'ai_pack', WED);
	const week = PLANS.free.week.ai;
	const bought = PACKS.ai_pack.amount;

	check('a pack lands in the pot that does not expire', a.meters.ai.extra === bought);
	check('and leaves the weekly pot alone', a.meters.ai.weekLeft === week);
	check('what is left is both pots together', P.left(a, 'ai') === week + bought);

	// Spend exactly the week's worth.
	for (let i = 0; i < week; i++) {
		const out = P.spend(a, 'ai', WED);
		check(`spend ${i + 1} of the weekly allowance is allowed`, out.ok);
		a = out.allowance;
	}
	check('the weekly pot is now empty', a.meters.ai.weekLeft === 0);
	check('and the bought pot is untouched', a.meters.ai.extra === bought, `extra ${a.meters.ai.extra}`);

	// The next one has to come out of what was bought.
	const next = P.spend(a, 'ai', WED);
	check('the next spend is still allowed', next.ok);
	check('and it comes out of the bought pot', next.allowance.meters.ai.extra === bought - 1);

	// The other meter was never touched by any of that.
	check(
		'spending one meter leaves the other alone',
		next.allowance.meters.analysis.weekLeft === PLANS.free.week.analysis
	);
}

console.log('\nAn empty meter refuses rather than going negative');
{
	let a = P.freshAllowance('free', WED);
	for (let i = 0; i < PLANS.free.week.analysis; i++) a = P.spend(a, 'analysis', WED).allowance;
	const out = P.spend(a, 'analysis', WED);
	check('the spend past the end is refused', !out.ok);
	check('and nothing went below zero', out.allowance.meters.analysis.weekLeft === 0);
	check('and the balance reads zero', P.left(out.allowance, 'analysis') === 0);
	check('while the other meter still works', P.spend(out.allowance, 'ai', WED).ok);
}

console.log('\nA quiet month comes back to ONE week, not to the weeks it slept through');
{
	let a = P.freshAllowance('personal', WED);
	a = P.addPack(a, 'analysis_pack', WED);
	for (let i = 0; i < 10; i++) a = P.spend(a, 'ai', WED).allowance;
	check('ten questions were spent', a.meters.ai.weekLeft === PLANS.personal.week.ai - 10);

	const nineWeeksOn = WED + 9 * 7 * DAY;
	const back = P.refill(a, nineWeeksOn);
	check(
		'nine weeks later the allowance is one week, not nine',
		back.meters.ai.weekLeft === PLANS.personal.week.ai,
		`got ${back.meters.ai.weekLeft}`
	);
	check('the week it belongs to moved with the clock', back.weekStart === P.weekStart(nineWeeksOn));
	check(
		'and what was bought outright survived every one of those Mondays',
		back.meters.analysis.extra === PACKS.analysis_pack.amount
	);

	/* Nothing to do inside the same week, and it says so by identity. The server writes
	   back only when this returns something new, so an identity that changed on every
	   read would be a database write on every request. */
	check('a refill inside the same week changes nothing', P.refill(a, WED + 3 * DAY) === a);
	check('and a spend rolls the week over on its own', P.spend(a, 'ai', nineWeeksOn).allowance.weekStart === P.weekStart(nineWeeksOn));
}

console.log('\nChanging plan hands over the whole new week, and keeps what was bought');
{
	let a = P.freshAllowance('free', WED);
	a = P.addPack(a, 'ai_pack', WED);
	// Spend the free tier dry, then upgrade mid-week.
	for (let i = 0; i < PLANS.free.week.ai; i++) a = P.spend(a, 'ai', WED).allowance;

	const up = P.setPlan(a, 'premier', WED);
	check('the plan moved', up.plan === 'premier');
	check(
		'the new week is whole, not the old remainder plus the difference',
		up.meters.ai.weekLeft === PLANS.premier.week.ai,
		`got ${up.meters.ai.weekLeft}`
	);
	check('the allowance printed beside it belongs to the new plan', up.meters.ai.week === PLANS.premier.week.ai);
	check('and the bought credits came along', up.meters.ai.extra === PACKS.ai_pack.amount);

	// And back down again, which is allowed to shrink what is left.
	const down = P.setPlan(up, 'free', WED);
	check('a downgrade lands on the smaller allowance', down.meters.ai.weekLeft === PLANS.free.week.ai);
	check('and still keeps what was bought outright', down.meters.ai.extra === PACKS.ai_pack.amount);
}

console.log('\nThe tables are complete and the ladder goes one way');
{
	check('every plan key has a plan', PLAN_KEYS.every((k) => PLANS[k] && PLANS[k].key === k));
	check('every pack key has a pack', PACK_KEYS.every((k) => PACKS[k] && PACKS[k].key === k));
	check('every pack names a meter that exists', PACK_KEYS.every((k) => METER_KEYS.includes(PACKS[k].meter)));
	check('there is a pack for every meter', METER_KEYS.every((m) => PACK_KEYS.some((k) => PACKS[k].meter === m)));

	/* The ladder has to be monotonic in both price and allowance. A tier that costs more
	   and grants less on ONE meter is a pricing page that argues with itself, and it is
	   exactly the kind of thing that survives a review of the numbers one column at a
	   time. */
	for (let i = 1; i < PLAN_KEYS.length; i++) {
		const lower = PLANS[PLAN_KEYS[i - 1]];
		const higher = PLANS[PLAN_KEYS[i]];
		check(`${higher.key} costs more than ${lower.key}`, higher.price > lower.price);
		for (const m of METER_KEYS) {
			check(
				`${higher.key} grants more ${m} than ${lower.key}`,
				higher.week[m] > lower.week[m],
				`${higher.week[m]} vs ${lower.week[m]}`
			);
		}
	}

	check('the free tier costs nothing', PLANS.free.price === 0);
	check('and it still grants something on every meter', METER_KEYS.every((m) => PLANS.free.week[m] > 0));
	check('every paid tier costs something', PLAN_KEYS.filter((k) => k !== 'free').every((k) => PLANS[k].price > 0));
	check('every pack costs something and grants something', PACK_KEYS.every((k) => PACKS[k].price > 0 && PACKS[k].amount > 0));

	check('a plan key is recognised', P.isPlanKey('premier') && !P.isPlanKey('platinum') && !P.isPlanKey(null));
	check('a pack key is recognised', P.isPackKey('ai_pack') && !P.isPackKey('ai') && !P.isPackKey(undefined));
}

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
