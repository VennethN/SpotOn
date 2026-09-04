import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { isEmail, isPassword } from '$lib/domain/account';
import {
	PLANS,
	addPack,
	freshAllowance,
	refill,
	setPlan,
	spend
} from '$lib/domain/plans';
import type { AccountView, Allowance, MeterKey, PackKey, PlanKey } from '$lib/types';
import {
	accounts as accountsCollection,
	ensureIndexes,
	hasDatabase,
	sessions as sessionsCollection,
	type AccountDoc
} from './mongo';

/**
 * Accounts, sessions and what each account has left.
 *
 * ONE set of rules, two places to keep them. With `MONGODB_URI` set the records live in
 * Mongo; without it they live in a Map in this process and the app is in demo mode. The
 * difference is storage and nothing else: the same password derivation runs, the same
 * session tokens are issued, the same allowance arithmetic in `domain/plans` decides
 * what is left. A branch that reached further than storage would mean the demo could
 * pass while the real thing was broken, which is the failure a demo mode is worth least
 * against.
 *
 * What demo mode does change is the front door, and it says so: signing in needs no
 * credentials, everybody lands on the same account, and the interface tells the reader
 * that nothing they do is being kept.
 */

/** How long a session is good for. Long enough to come back tomorrow, short enough that
    a token left behind on a shared machine is not good next month. */
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 86_400_000;

export const SESSION_COOKIE = 'spoton_session';

/**
 * What went wrong, as something the interface can turn into a sentence.
 *
 * A code rather than a message, because the message has to exist in both languages and
 * this module has no business choosing which one the reader is in.
 */
export type AuthError = 'taken' | 'credentials' | 'invalid' | 'unavailable';

export interface Signed {
	account: AccountView;
	/** The raw token. Goes in the cookie and is never stored anywhere. */
	token: string;
	expires: Date;
}

export type AuthResult = { ok: true; signed: Signed } | { ok: false; error: AuthError };

/* ------------------------------------------------------------------ passwords */

/**
 * scrypt, salted per account, stored as `salt:derived`.
 *
 * Deliberately not a bare hash. A password column is the one thing in here that is worth
 * stealing on its own, because people reuse them, and a fast hash over a stolen dump is
 * a dictionary attack that finishes over lunch. scrypt is in Node's own crypto, so this
 * costs no dependency.
 *
 * The comparison is constant time. A byte-by-byte one leaks how much of a guess was
 * right through how long it took to reject it.
 */
function hashPassword(password: string): string {
	const salt = randomBytes(16);
	return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password: string, stored: string): boolean {
	const [saltHex, wantHex] = stored.split(':');
	if (!saltHex || !wantHex) return false;
	const want = Buffer.from(wantHex, 'hex');
	const got = scryptSync(password, Buffer.from(saltHex, 'hex'), want.length);
	return want.length === got.length && timingSafeEqual(want, got);
}

/** What is stored for a session: the digest of the token, never the token. */
const digest = (token: string): string => createHash('sha256').update(token).digest('hex');

const newToken = (): string => randomBytes(32).toString('hex');

/* ------------------------------------------------------------------ validation */

const cleanName = (v: unknown, fallback: string): string => {
	const s = typeof v === 'string' ? v.trim().slice(0, 80) : '';
	return s || fallback;
};

const normalEmail = (v: string): string => v.trim().toLowerCase();

/* ------------------------------------------------------------------ the record */

/** The stored shape, in the one place it is turned into the shape the app reads. */
function toAllowance(doc: AccountDoc): Allowance {
	const plan: PlanKey = doc.plan in PLANS ? (doc.plan as PlanKey) : 'free';
	const meter = (key: MeterKey) => {
		const week = PLANS[plan].week[key];
		const stored = doc.meters?.[key];
		return {
			week,
			/* Clamped against the plan rather than trusted. A tier's allowance can be cut
			   between one week and the next, and a document written under the old figure
			   would otherwise go on granting it until the Monday. */
			weekLeft: Math.max(0, Math.min(week, stored?.weekLeft ?? week)),
			extra: Math.max(0, stored?.extra ?? 0)
		};
	};
	return { plan, weekStart: doc.weekStart, meters: { ai: meter('ai'), analysis: meter('analysis') } };
}

function toView(doc: AccountDoc, allowance: Allowance, demo: boolean): AccountView {
	return { id: doc._id, email: doc.email, name: doc.name, allowance, demo };
}

function newDoc(id: string, email: string, name: string, password: string, now: number): AccountDoc {
	const a = freshAllowance('free', now);
	return {
		_id: id,
		email,
		name,
		password,
		plan: a.plan,
		weekStart: a.weekStart,
		meters: {
			ai: { weekLeft: a.meters.ai.weekLeft, extra: a.meters.ai.extra },
			analysis: { weekLeft: a.meters.analysis.weekLeft, extra: a.meters.analysis.extra }
		},
		createdAt: now
	};
}

/** The fields an allowance writes back. `week` is not among them: it belongs to the
    plan, and storing it would be a second copy of a figure `domain/plans` already holds. */
function allowanceFields(a: Allowance) {
	return {
		plan: a.plan,
		weekStart: a.weekStart,
		meters: {
			ai: { weekLeft: a.meters.ai.weekLeft, extra: a.meters.ai.extra },
			analysis: { weekLeft: a.meters.analysis.weekLeft, extra: a.meters.analysis.extra }
		}
	};
}

/* ------------------------------------------------------------------ demo storage */

/**
 * The demo account, and every account created while there is no database.
 *
 * A Map in the process, so it lives as long as the server does and no longer. That is
 * the honest behaviour and the interface says it out loud rather than letting somebody
 * discover on Tuesday that Monday's purchase is gone.
 */
const DEMO_ID = 'demo';
const DEMO_EMAIL = 'demo@spoton.id';
/* A name, not a sentence, so it reads the same in both languages. What has to be
   EXPLAINED about this account is a sentence, and that lives in `i18n` beside every
   other sentence, keyed off `AccountView.demo`. */
const DEMO_NAME = 'Demo';

const memoryAccounts = new Map<string, AccountDoc>();
const memorySessions = new Map<string, { account: string; expires: number }>();

function demoDoc(now: number): AccountDoc {
	const found = memoryAccounts.get(DEMO_ID);
	if (found) return found;
	/* No password: this account cannot be signed into with one, because in demo mode
	   nothing is asked for. A stored derivation of some fixed string would look like a
	   credential and be worth exactly nothing, which is the worst of both. */
	const doc = newDoc(DEMO_ID, DEMO_EMAIL, DEMO_NAME, '', now);
	memoryAccounts.set(DEMO_ID, doc);
	return doc;
}

/* ------------------------------------------------------------------ sessions */

async function openSession(id: string): Promise<{ token: string; expires: Date }> {
	const token = newToken();
	const expires = new Date(Date.now() + SESSION_MS);
	if (hasDatabase()) {
		await ensureIndexes();
		const s = await sessionsCollection();
		await s.insertOne({ _id: digest(token), account: id, createdAt: Date.now(), expiresAt: expires });
	} else {
		memorySessions.set(digest(token), { account: id, expires: expires.getTime() });
	}
	return { token, expires };
}

/** Ends one session. Signing out of one browser must not sign out of the others. */
export async function closeSession(token: string | undefined): Promise<void> {
	if (!token) return;
	const key = digest(token);
	if (!hasDatabase()) {
		memorySessions.delete(key);
		return;
	}
	try {
		await (await sessionsCollection()).deleteOne({ _id: key });
	} catch (err) {
		// The cookie is cleared by the caller either way, so the reader IS signed out.
		// Worth a line in the log and not worth a failed response.
		console.error('[SpotOn] Could not delete session:', (err as Error).message);
	}
}

/* ------------------------------------------------------------------ reading */

async function docById(id: string): Promise<AccountDoc | null> {
	if (!hasDatabase()) return memoryAccounts.get(id) ?? null;
	return (await accountsCollection()).findOne({ _id: id });
}

/**
 * Who this request is, read from the session cookie.
 *
 * The allowance is brought up to date on the way past, and written back only when the
 * week actually turned. `refill` returns the same object when nothing moved, so the
 * common case, which is every request inside the same week, costs no write at all.
 *
 * A failure to reach the database is not thrown from here. It returns nobody, which is
 * what the rest of the app already knows how to draw: a reader who is not signed in.
 * A cluster that is asleep must not turn the map into a stack trace.
 */
export async function accountForToken(token: string | undefined): Promise<AccountView | null> {
	if (!token) return null;
	try {
		const key = digest(token);
		let id: string | null = null;
		if (hasDatabase()) {
			await ensureIndexes();
			const row = await (await sessionsCollection()).findOne({ _id: key });
			// The TTL index sweeps expired rows, but it runs about once a minute, so the
			// expiry is checked here as well rather than trusted to have been swept.
			if (row && row.expiresAt.getTime() > Date.now()) id = row.account;
		} else {
			const row = memorySessions.get(key);
			if (row && row.expires > Date.now()) id = row.account;
		}
		if (!id) return null;

		const doc = await docById(id);
		if (!doc) return null;
		return toView(doc, await freshen(doc), !hasDatabase());
	} catch (err) {
		console.error('[SpotOn] Could not read the session:', (err as Error).message);
		return null;
	}
}

/** The allowance as of now, written back if and only if the week turned. */
async function freshen(doc: AccountDoc): Promise<Allowance> {
	const stored = toAllowance(doc);
	const now = Date.now();
	const current = refill(stored, now);
	if (current === stored) return stored;
	await write(doc._id, current);
	return current;
}

async function write(id: string, allowance: Allowance): Promise<void> {
	if (!hasDatabase()) {
		const doc = memoryAccounts.get(id);
		if (doc) memoryAccounts.set(id, { ...doc, ...allowanceFields(allowance) });
		return;
	}
	await (await accountsCollection()).updateOne({ _id: id }, { $set: allowanceFields(allowance) });
}

/* ------------------------------------------------------------------ signing in */

/**
 * Sign in without credentials, onto the one shared demo account.
 *
 * Refused outright when a database is configured. It is a door that only exists because
 * there is nothing behind it to protect, and it must not survive the moment there is.
 */
export async function signInDemo(): Promise<AuthResult> {
	if (hasDatabase()) return { ok: false, error: 'unavailable' };
	const doc = demoDoc(Date.now());
	const { token, expires } = await openSession(doc._id);
	return { ok: true, signed: { account: toView(doc, await freshen(doc), true), token, expires } };
}

export async function signIn(email: unknown, password: unknown): Promise<AuthResult> {
	// In demo mode there is one account and no password on it, so a form filled in
	// carefully lands in the same place the button does rather than being turned away.
	if (!hasDatabase()) return signInDemo();
	if (!isEmail(email) || typeof password !== 'string') return { ok: false, error: 'credentials' };

	try {
		await ensureIndexes();
		const doc = await (await accountsCollection()).findOne({ email: normalEmail(email) });
		/* The same answer whether the address is unknown or the password is wrong. Saying
		   which would turn this endpoint into a way of asking whether somebody has an
		   account here, which is not ours to answer. */
		if (!doc || !doc.password || !passwordMatches(password, doc.password)) {
			return { ok: false, error: 'credentials' };
		}
		const { token, expires } = await openSession(doc._id);
		return { ok: true, signed: { account: toView(doc, await freshen(doc), false), token, expires } };
	} catch (err) {
		console.error('[SpotOn] Sign-in failed:', (err as Error).message);
		return { ok: false, error: 'unavailable' };
	}
}

export async function register(
	email: unknown,
	password: unknown,
	name: unknown
): Promise<AuthResult> {
	// Nothing to create in demo mode: there is one account and everybody is on it.
	if (!hasDatabase()) return signInDemo();
	if (!isEmail(email) || !isPassword(password)) return { ok: false, error: 'invalid' };

	const address = normalEmail(email);
	try {
		await ensureIndexes();
		const now = Date.now();
		const doc = newDoc(
			randomBytes(12).toString('hex'),
			address,
			cleanName(name, address.split('@')[0]),
			hashPassword(password),
			now
		);
		await (await accountsCollection()).insertOne(doc);
		const { token, expires } = await openSession(doc._id);
		return { ok: true, signed: { account: toView(doc, toAllowance(doc), false), token, expires } };
	} catch (err) {
		/* 11000 is the unique index on `email` refusing a second account for one address.
		   That is the index doing its job, not a fault: two sign-ups racing each other is
		   exactly the case a check-then-insert cannot cover on its own. */
		if ((err as { code?: number }).code === 11000) return { ok: false, error: 'taken' };
		console.error('[SpotOn] Registration failed:', (err as Error).message);
		return { ok: false, error: 'unavailable' };
	}
}

/* ------------------------------------------------------------------ the meters */

export type SpendResult =
	| { ok: true; account: AccountView }
	| { ok: false; reason: 'empty' | 'unavailable'; account: AccountView | null };

/**
 * One unit off one meter, for one account.
 *
 * The arithmetic is `domain/plans`; what is here is only the part that has to survive
 * two requests arriving at once. The write is guarded on the numbers the decision was
 * made from, so a spend that was computed against a balance somebody else has already
 * moved is refused by the database rather than written over the top of theirs. A miss
 * re-reads and tries again, which is the only case that costs a second round trip.
 *
 * Without that guard the last write wins, and the reader with two tabs open gets both
 * readings for the price of one. It is a small theft and it is still the meter being
 * wrong, in a product whose whole claim is that its figures are not.
 */
export async function spendMeter(id: string, meter: MeterKey): Promise<SpendResult> {
	try {
		for (let attempt = 0; attempt < 3; attempt++) {
			const doc = await docById(id);
			if (!doc) return { ok: false, reason: 'unavailable', account: null };

			const before = toAllowance(doc);
			const { ok, allowance } = spend(before, meter, Date.now());
			if (!ok) return { ok: false, reason: 'empty', account: toView(doc, allowance, !hasDatabase()) };

			if (!hasDatabase()) {
				memoryAccounts.set(id, { ...doc, ...allowanceFields(allowance) });
				return { ok: true, account: toView(doc, allowance, true) };
			}

			/* Guarded on what is IN THE DOCUMENT, not on what `toAllowance` read out of it.
			   The two differ whenever a tier's weekly allowance has been LOWERED under an
			   account still holding more than the new figure: the reading is clamped to the
			   plan and the document is not, so a guard built from the reading would never
			   match its own row, and every spend on that account would fail as unavailable
			   until the Monday. A null matches a field that is not there, which is what an
			   account written before a meter existed looks like. */
			const stored = doc.meters ?? {};
			const res = await (await accountsCollection()).updateOne(
				{
					_id: id,
					weekStart: doc.weekStart,
					'meters.ai.weekLeft': stored.ai?.weekLeft ?? null,
					'meters.ai.extra': stored.ai?.extra ?? null,
					'meters.analysis.weekLeft': stored.analysis?.weekLeft ?? null,
					'meters.analysis.extra': stored.analysis?.extra ?? null
				},
				{ $set: allowanceFields(allowance) }
			);
			if (res.matchedCount === 1) return { ok: true, account: toView(doc, allowance, false) };
		}
		/* Three misses in a row is not contention any more, it is something else, and
		   granting the reading anyway would be spending nothing. Refused as unavailable
		   rather than as empty, because their balance is not the reason. */
		console.error('[SpotOn] Could not settle a spend after three tries.');
		return { ok: false, reason: 'unavailable', account: null };
	} catch (err) {
		console.error('[SpotOn] Could not spend:', (err as Error).message);
		return { ok: false, reason: 'unavailable', account: null };
	}
}

/* ------------------------------------------------------------------ buying */

/**
 * Move an account onto another tier.
 *
 * There is no payment here and the interface says so. Wiring a processor in is a
 * commercial decision with a contract behind it, and standing in a fake one would put a
 * card form on the screen that goes nowhere, which is worse than an honest button. What
 * this does is everything that follows a payment, so the day a processor is added it is
 * called from its webhook and nothing below it changes.
 */
export async function changePlan(id: string, plan: PlanKey): Promise<AccountView | null> {
	return update(id, (a) => setPlan(a, plan, Date.now()));
}

/** Add a bought pack to the pot that does not expire. Same note as `changePlan`. */
export async function buyPack(id: string, pack: PackKey): Promise<AccountView | null> {
	return update(id, (a) => addPack(a, pack, Date.now()));
}

/**
 * Read, change, write, with no guard on the write.
 *
 * Deliberately, and only because of which way it can go wrong. A spend landing between
 * the read and the write is lost, so the reader keeps one credit they had just used.
 * The opposite cannot happen: `spendMeter` guards on the stored numbers, so a spend
 * racing a purchase misses its own guard and re-reads the purchased balance. The one
 * outcome this leaves is a credit in the READER's favour, once, in a window of
 * milliseconds around a button they pressed themselves.
 */
async function update(id: string, change: (a: Allowance) => Allowance): Promise<AccountView | null> {
	try {
		const doc = await docById(id);
		if (!doc) return null;
		const allowance = change(refill(toAllowance(doc), Date.now()));
		await write(id, allowance);
		return toView(doc, allowance, !hasDatabase());
	} catch (err) {
		console.error('[SpotOn] Could not change the plan:', (err as Error).message);
		return null;
	}
}
