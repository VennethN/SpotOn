// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AccountView } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/**
			 * Who this request is, resolved from the session cookie by `hooks.server.ts`.
			 *
			 * Null means signed out, which is a normal state rather than a failure: the
			 * landing page and the sign-in page are both drawn for it. It is also what a
			 * database that could not be reached comes back as, so nothing downstream has
			 * to know the difference between "nobody is here" and "we could not tell".
			 */
			account: AccountView | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
