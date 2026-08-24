/**
 * What counts as a usable address and a usable password.
 *
 * In the domain rather than in `server/accounts` because both sides need it. The form
 * needs the minimum length to print it and to let the browser enforce it, and the server
 * needs it to be the rule. Written twice, the form would go on accepting seven
 * characters for a week after the server stopped, and the reader would be told their
 * password was wrong by a page that had just told them it was fine.
 *
 * The server is still the one that decides. This is the same rule stated once, not a
 * check the server trusts the browser to have run.
 */

/** Long enough to be worth deriving a key from, and it is a floor rather than a policy.
    A rule demanding a symbol and a digit buys less than four more characters do, and it
    is what makes people write the password down. */
export const MIN_PASSWORD_LENGTH = 8;

/** Capped so nobody can hand the hash function an essay to chew through. */
const MAX_PASSWORD_LENGTH = 200;

/**
 * Deliberately loose, and it only has to be.
 *
 * No regular expression can prove an address is deliverable, and every strict pattern
 * anybody writes turns some real address away. This checks the shape a login form needs
 * and nothing more.
 */
export function isEmail(v: unknown): v is string {
	return typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isPassword(v: unknown): v is string {
	return (
		typeof v === 'string' &&
		v.length >= MIN_PASSWORD_LENGTH &&
		v.length <= MAX_PASSWORD_LENGTH
	);
}
