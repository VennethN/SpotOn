import { getContext, setContext } from 'svelte';
import { PACKS, left, spend } from '$lib/domain/plans';
import type { AccountView, MeterKey, PackKey, PlanKey } from '$lib/types';

/**
 * Who is signed in, and what they have left.
 *
 * Held in a context rather than at module level, unlike the language. The language is
 * one reader's preference and is only ever set in a browser; an account is per request,
 * and a module-level copy on the server would be one request's balance visible to the
 * next reader served by the same instance.
 *
 * The server is the authority on every figure here. What this class holds is the last
 * thing the server said plus whatever has been spent since, so the screen can be right
 * before the network has caught up. Where the two ever disagree, the server wins and
 * this is overwritten from it.
 */

const KEY = Symbol('spoton:account');

export class AccountState {
	account = $state<AccountView | null>(null);
	/** A purchase or a sign-out is in flight, so the buttons say so and cannot be
	    pressed twice into two charges. */
	busy = $state(false);
	/** The last thing that went wrong buying something, as a code for `i18n` to say. */
	failed = $state<string | null>(null);

	constructor(account: AccountView | null) {
		this.account = account;
	}

	get signedIn(): boolean {
		return this.account !== null;
	}

	/** What is left on one meter, both pots together. Zero when nobody is signed in,
	    which is the state that cannot spend anything. */
	left(meter: MeterKey): number {
		return this.account ? left(this.account.allowance, meter) : 0;
	}

	/**
	 * Take one off the local reading.
	 *
	 * Optimistic on purpose. Opening an area already waits on the points, the listings
	 * and the timetables around it, and every one of those is drawn as it lands; putting
	 * a network round trip in front of the card OPENING would be the one part of that
	 * sequence the reader waits on with nothing to look at.
	 *
	 * It is not the spend. The server does that, and it is the one that counts. This
	 * only keeps the figure on the screen from being a number the reader has already
	 * disproved by clicking.
	 */
	take(meter: MeterKey): boolean {
		if (!this.account) return false;
		const { ok, allowance } = spend(this.account.allowance, meter, Date.now());
		if (!ok) return false;
		this.account = { ...this.account, allowance };
		return true;
	}

	/**
	 * Spend one analysis on the server, and take its answer over ours.
	 *
	 * False means the server refused, which after a successful `take` can only be two
	 * tabs spending the same last credit. Rare, and the caller has to undo the reading
	 * rather than leave one on the screen that was not paid for.
	 */
	async settleAnalysis(): Promise<boolean> {
		try {
			const res = await fetch('/api/analysis', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			const body = (await res.json()) as { account?: AccountView };
			if (body.account) this.account = body.account;
			return res.ok;
		} catch {
			/* The network dropped, so nobody knows whether it was spent. Kept as spent:
			   the reader has the reading in front of them, and the next thing that reaches
			   the server corrects the figure. Refusing it here would take away a card that
			   is already open and already read. */
			return true;
		}
	}

	/** Re-read the balances. Cheap, and the only way the browser learns what the AI
	    endpoint actually charged, since that spend happens inside the answer. */
	async refresh(): Promise<void> {
		try {
			const res = await fetch('/api/account');
			if (!res.ok) return;
			const body = (await res.json()) as { account: AccountView | null };
			this.account = body.account;
		} catch {
			// Left as it was. A balance that is one out of date is better than a screen
			// that clears itself every time a request drops.
		}
	}

	/** Move onto another tier. There is no payment behind this and the page says so. */
	async subscribe(plan: PlanKey): Promise<boolean> {
		return this.#buy({ plan });
	}

	/** Buy one top-up outright. Same note as `subscribe`. */
	async topUp(pack: PackKey): Promise<boolean> {
		if (!(pack in PACKS)) return false;
		return this.#buy({ pack });
	}

	async #buy(body: { plan: PlanKey } | { pack: PackKey }): Promise<boolean> {
		if (this.busy) return false;
		this.busy = true;
		this.failed = null;
		try {
			const res = await fetch('/api/billing', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = (await res.json()) as { account?: AccountView; error?: string };
			if (!res.ok || !out.account) {
				this.failed = out.error ?? 'unavailable';
				return false;
			}
			this.account = out.account;
			return true;
		} catch {
			this.failed = 'unavailable';
			return false;
		} finally {
			this.busy = false;
		}
	}

	async signOut(): Promise<void> {
		this.busy = true;
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			this.account = null;
		} catch {
			// The cookie may well have been cleared anyway. Reloading is what the caller
			// does next, and the server decides what it finds.
		} finally {
			this.busy = false;
		}
	}
}

export function setAccountState(account: AccountView | null): AccountState {
	return setContext(KEY, new AccountState(account));
}

export function getAccountState(): AccountState {
	return getContext<AccountState>(KEY);
}
