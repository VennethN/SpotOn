import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { cacheTiles } from './tilecache.mjs';

/**
 * Shoots the app states the deck and the poster show, on the basemap, at twice the
 * pixel density, into shots/. crops.py then cuts, rounds and resizes them into the
 * poster's img/ and the deck's crops/.
 *
 * Run from this directory against the dev server, set up as video/record.mjs says. It
 * asks the same question as the video and opens the same first answer, so every figure
 * the deck and the poster quote is the one on the screen. Two of the demo account's
 * weekly questions are spent per run.
 */
const base = 'http://127.0.0.1:5173';
const QUESTION = 'Where should I open a coffee shop near a station?';
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });

/* Mid-afternoon in Jakarta, for the same reason the video is shot then: the models are
   lit by Jakarta's clock. Only the light follows it. */
const SHOOT_HOUR = 15;
const JAKARTA = 7;
function shootTime() {
  const jakarta = new Date(Date.now() + JAKARTA * 3600e3);
  jakarta.setUTCHours(SHOOT_HOUR, 0, 0, 0);
  return new Date(jakarta.getTime() - JAKARTA * 3600e3);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2,
  colorScheme: 'light', locale: 'en-US', timezoneId: 'Asia/Jakarta',
  // The machine this was shot on sends its HTTPS through a proxy whose certificate
  // Chromium does not trust. Harmless anywhere the certificates are real.
  ignoreHTTPSErrors: true
});
await cacheTiles(ctx, path.join(here, 'tilecache'));
await ctx.clock.setSystemTime(shootTime());
const page = await ctx.newPage();
const shot = (name, o = {}) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 120000, ...o });

/* The toggle is in the server's HTML before the page has hydrated, and a click before
   then does nothing, so this presses until the page shows a line it only shows in
   English. */
async function english(sign) {
  const en = page.getByRole('button', { name: 'EN', exact: true }).first();
  const shown = page.getByText(sign).first();
  for (let i = 0; i < 200 && !(await shown.count()); i++) {
    if (await en.count()) await en.click({ force: true, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

await ctx.request.post(base + '/api/auth/login', { data: {} });
await page.goto(base + '/app', { waitUntil: 'load' });
// The page opens in Indonesian, and the question box is found by its English label,
// so the language comes first.
await page.getByRole('button', { name: 'EN', exact: true }).first().waitFor({ timeout: 60000 });
await english('What do you want to open?');
const box = page.locator('input[aria-label="Ask Tapak"]:visible').first();
await box.waitFor({ timeout: 60000 });
await page.waitForTimeout(6000);

/* Tapak's sentences are read out at speaking pace, so a shot waits until the guide's
   text has stopped growing for a while. */
async function spoken() {
  const guide = page.locator('aside.guide');
  let last = -1; let still = 0;
  for (let i = 0; i < 240 && still < 5; i++) {
    const n = (await guide.textContent().catch(() => ''))?.length ?? 0;
    still = n === last ? still + 1 : 0; last = n;
    await page.waitForTimeout(500);
  }
}

await box.focus(); await page.keyboard.type(QUESTION, { delay: 10 }); await page.keyboard.press('Enter');
await page.getByRole('button', { name: /^1 [A-Z]/ }).first().waitFor({ timeout: 30000 });
await spoken(); await page.waitForTimeout(3000);
await shot('app-rank');

// The whole scored city, raised, before any one cell is opened and flown to. A wider
// viewport, so a chrome-free crop of it can be cut from between the guide and the legend.
await page.setViewportSize({ width: 1920, height: 1080 });
await page.waitForTimeout(5000);
await page.locator('button', { hasText: /^3D$/ }).first().click({ force: true, noWaitAfter: true });
await page.waitForTimeout(8000);
await shot('map-3d');
await page.locator('button', { hasText: /^Flat$/ }).first().click({ force: true, noWaitAfter: true });
await page.setViewportSize({ width: 1600, height: 900 });
await page.waitForTimeout(4000);

await page.getByRole('button', { name: /^1 [A-Z]/ }).first().click({ force: true, noWaitAfter: true });
await page.waitForFunction(() => document.querySelector('.dio .mark')?.textContent?.startsWith('buildings'), null, { timeout: 180000 }).catch(() => console.log('the model never built'));
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Opportunity score/ }).first().click({ force: true, noWaitAfter: true });
await page.waitForTimeout(1500);
/* Clipped from the page rather than shot as elements: an element screenshot waits for
   the element to hold still between animation frames, and drawn by software at a frame
   a second that wait never ends. */
const clip = async (locator, name) => {
  const box = await locator.boundingBox();
  console.log(name, box);
  await shot(name, { clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } });
};
await clip(page.locator('aside.spot'), 'card');

await page.getByRole('button', { name: /^Why / }).first().click({ force: true, noWaitAfter: true });
await page.waitForTimeout(3000); await spoken(); await page.waitForTimeout(1500);
await clip(page.locator('aside.guide'), 'why');
await browser.close();
console.log('shots/: app-rank, card, why, map-3d');
