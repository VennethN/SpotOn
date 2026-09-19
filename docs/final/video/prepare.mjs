import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds what the two card pages reference and the repository does not carry: the
 * display font, the white mark, the QR code, and the hero picture behind the title.
 *
 * Run from this directory with the dev server up on 127.0.0.1:5173. Everything it
 * writes lands under cards/ and is ignored by git, since each is a copy of something
 * already in the repository or a picture of the running site.
 */
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../..');
const cards = path.join(here, 'cards');
const base = 'http://127.0.0.1:5173';

fs.mkdirSync(path.join(cards, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'static/fonts'))) {
  fs.copyFileSync(path.join(root, 'static/fonts', f), path.join(cards, 'fonts', f));
}
fs.copyFileSync(path.join(here, '../poster/img/mark-white.png'), path.join(cards, 'mark-white.png'));
fs.copyFileSync(path.join(here, '../qr-spot-on-three.png'), path.join(cards, 'qr.png'));

/* The landing hero with every word hidden: the street block at the hour the page opens
   on, and nothing written over it, so the cards can put their own words there. */
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-US',
  ignoreHTTPSErrors: true
});
await page.goto(base + '/', { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  const hide = (el) => el && (el.style.visibility = 'hidden');
  hide(document.querySelector('nav[aria-label]')?.parentElement);
  for (const el of document.querySelectorAll('.stage .copy, .stage .clock')) hide(el);
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(cards, 'hero.png') });
await browser.close();
console.log('cards/: fonts, mark-white.png, qr.png, hero.png');
