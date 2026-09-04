import { SESSION_COOKIE, type Signed } from './accounts';
import type { Cookies } from '@sveltejs/kit';

/**
 * The session cookie, written in one place.
 *
 * Four flags and every one of them matters, which is exactly why they are not spelled
 * out at three call sites where one of them could quietly go missing:
 *
 * - `httpOnly` keeps the token out of `document.cookie`, so a script that gets onto the
 *   page cannot read it and post it somewhere.
 * - `sameSite: 'lax'` means the cookie is not sent on a cross-site POST, which is what
 *   stops another site making a purchase or spending a reading on somebody's behalf.
 *   Lax rather than strict so that following a link into SpotOn from anywhere else
 *   arrives signed in, which is what a reader expects and costs nothing here.
 * - `secure` in production only. Set unconditionally, the cookie would never be stored
 *   over the plain-HTTP dev server and nobody could sign in locally.
 * - `path: '/'` so the app, the account page and the endpoints all see it.
 */
export function setSessionCookie(cookies: Cookies, signed: Signed, dev: boolean): void {
	cookies.set(SESSION_COOKIE, signed.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: signed.expires
	});
}

/** Take the cookie back. The path has to match the one it was written with, or the
    browser keeps the original and the reader stays signed in. */
export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
