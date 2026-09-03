import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { hasDatabase } from '$lib/server/mongo';
import type { LayoutServerLoad } from './$types';

/**
 * The app needs an account, and this is where that is decided.
 *
 * Here rather than in the hook, because the hook serves the landing page too and that
 * one is for anybody. Only the map is metered, so only the map asks who is looking.
 *
 * `next` carries where they were going, so signing in lands them on the map rather than
 * back at the front door. In demo mode that whole trip is one button.
 *
 * A LAYOUT load rather than the page's own, so it also stands in front of anything else
 * that comes to live under `/app` later. The page's `+page.ts` keeps the grid fetch: it
 * runs on both sides and is nothing to do with who is asking.
 *
 * The MAPID Map Service key rides down with the account. It has no `PUBLIC_` prefix, so
 * this is the only side that can read it, and the map is the only page that needs it.
 * It is a browser-side key by design, the same one MapLibre puts in the style URL, so
 * handing it over is not a leak. Read through `$env/dynamic/private` for the reason
 * `mongo.ts` reads its URI that way: on Vercel it is an Environment Variable edit, not
 * a rebuild.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.account) {
		redirect(303, `/signin?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return {
		account: locals.account,
		demo: !hasDatabase(),
		mapidKey: env.MAPID_MAPSERVICES_KEY?.trim() || null
	};
};
