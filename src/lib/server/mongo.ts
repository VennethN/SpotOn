import { env } from '$env/dynamic/private';
import { MongoClient, type Collection, type Db } from 'mongodb';

/**
 * The database, and the one place the question "is there one" is answered.
 *
 * `MONGODB_URI` empty means DEMO MODE, and demo mode is a first-class way to run this
 * product rather than a failure to configure it. Nothing about the app changes shape:
 * accounts still exist, sessions still exist, the meters still count down and the plans
 * still cost what they cost. What changes is where the records live, which in demo mode
 * is a Map in this process, and how signing in works, which is one button.
 *
 * That is deliberate. This is a competition entry that has to be openable by a judge
 * from a bare clone with no keys, exactly the way the map already works without a MAPID
 * key and the way questions are still answered without a model key. A login wall in
 * front of that would be the first thing in the product that stops working when a
 * secret is missing.
 *
 * Read through `$env/dynamic/private` rather than the static import, for the same
 * reason `llm.ts` reads its model that way: it is read at runtime, so pointing a Vercel
 * deployment at a cluster is an Environment Variable edit rather than a rebuild.
 */

/** True when a database is configured. The interface says so out loud, so read it there too. */
export function hasDatabase(): boolean {
	return Boolean(env.MONGODB_URI?.trim());
}

/** The database name, when the URI does not carry one. */
const DEFAULT_DB = 'spoton';

/**
 * One client for the whole process, connected on first use and never on import.
 *
 * Connecting at import time would make every route, including the ones that never touch
 * an account, wait on a network handshake before rendering. It would also run during
 * the build, when the landing page is prerendered, in an environment that has no
 * business reaching a production cluster.
 *
 * The promise itself is cached rather than the client, so two requests arriving together
 * on a cold start share one handshake instead of opening two pools.
 */
let pending: Promise<Db> | null = null;

function connect(): Promise<Db> {
	const uri = env.MONGODB_URI?.trim();
	if (!uri) throw new Error('MONGODB_URI is empty.');

	const client = new MongoClient(uri, {
		// A serverless function is billed for the wait, and a cluster that is asleep or
		// firewalled would otherwise hold a request for half a minute before admitting
		// it cannot be reached. Ten seconds is long enough for a cold Atlas cluster and
		// short enough that the reader is told rather than left watching.
		serverSelectionTimeoutMS: 10_000,
		// Each instance handles a handful of concurrent requests, and the accounts here
		// are read once per request. A large pool would be idle sockets against a
		// cluster's own connection limit.
		maxPoolSize: 8
	});

	return client
		.connect()
		.then((c) => c.db(env.MONGODB_DB?.trim() || DEFAULT_DB))
		.catch((err) => {
			// Cleared so the NEXT request tries again. Left in place, one failed handshake
			// on a cold start would be remembered for the life of the instance and every
			// later request would be refused by a cached rejection rather than retried.
			pending = null;
			throw err;
		});
}

export function db(): Promise<Db> {
	pending ??= connect();
	return pending;
}

/** One account, as it is stored. Never handed to the browser — see `AccountView`. */
export interface AccountDoc {
	_id: string;
	email: string;
	name: string;
	/** scrypt, as `salt:derived` in hex. Absent on an account that cannot be signed into
	    with a password, which today means none of them. */
	password: string;
	plan: string;
	weekStart: number;
	/** Kept flat rather than as the nested `Allowance`, so a meter added later reads as
	    an absent number on an old document rather than as a missing object to walk into. */
	meters: Record<string, { weekLeft: number; extra: number }>;
	createdAt: number;
}

/**
 * One signed-in session.
 *
 * `_id` is the SHA-256 of the cookie's token, never the token. A dump of this collection
 * therefore hands over nothing that can be presented as a session, the same reason the
 * password column holds a derivation rather than a password.
 */
export interface SessionDoc {
	_id: string;
	account: string;
	createdAt: number;
	expiresAt: Date;
}

export async function accounts(): Promise<Collection<AccountDoc>> {
	return (await db()).collection<AccountDoc>('accounts');
}

export async function sessions(): Promise<Collection<SessionDoc>> {
	return (await db()).collection<SessionDoc>('sessions');
}

/**
 * The two indexes the store depends on for correctness rather than for speed.
 *
 * The unique one on `email` is what makes "this address is taken" true under two
 * sign-ups racing each other. A check-then-insert cannot promise that on its own, and
 * the two accounts it lets through are not a slow query, they are a reader who can no
 * longer sign in to the right one.
 *
 * The TTL on `expiresAt` is what makes a session expire on the server as well as in the
 * cookie. Without it a stolen token stays good for as long as the row sits there, which
 * is forever, and the expiry would only be a hint the browser is trusted to honour.
 *
 * Run once per process, from the first request that needs the collections. Creating an
 * index that already exists is a no-op, so this costs one round trip on a cold start.
 */
let ensured: Promise<void> | null = null;

export function ensureIndexes(): Promise<void> {
	ensured ??= (async () => {
		const [a, s] = [await accounts(), await sessions()];
		await a.createIndex({ email: 1 }, { unique: true });
		await s.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	})().catch((err) => {
		ensured = null;
		throw err;
	});
	return ensured;
}
