import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { cacheTiles } from '../tilecache.mjs';

/**
 * Records the four scenes the video is cut from, one MP4 each under raw/, and writes
 * raw/log.json: the moment each beat happened, which assemble.py cuts by.
 *
 * FRAME BY FRAME, NOT IN REAL TIME. Without a GPU the page draws its models at a frame
 * or two a second, and a screen recording of that is a slideshow. So the page's clock is
 * taken over: every timer, animation frame and reading of the time inside the page
 * moves only when this script moves it, forty milliseconds a frame, and each frame is
 * screenshotted and piped to ffmpeg. The models, the springs, the typed sentences and
 * the map's own moves all run on that clock, so they come out smooth however long a
 * frame takes to draw. Between beats, while the network is being waited for, the clock
 * runs at real speed and nothing is kept. What cannot be driven this way is a CSS
 * transition, which runs on the real clock: the reveals on the landing page are fired
 * before the first frame is kept, and the captions are moved by hand.
 *
 * Run from this directory against `npm run dev -- --port 5173 --host 127.0.0.1` with the
 * MAPID Map Service key set and MONGODB_URI empty, so signing in is one call. The demo
 * account has a small weekly allowance of questions and every take spends two, so
 * restart the dev server between takes. `node record.mjs app` re-records one scene and
 * keeps the other scenes' marks. A full take is slow, about half an hour on four cores.
 */
const base = 'http://127.0.0.1:5173';
const V = { width: 1920, height: 1080 };
const FPS = 25;
const STEP = 1000 / FPS;
const QUESTION = 'Where should I open a coffee shop near a station?';
const here = path.dirname(new URL(import.meta.url).pathname);

/* The models are lit by Jakarta's clock, and a take made at one in the morning there
   would show every street dark. So the page's clock opens on the same day at SHOOT_HOUR
   in Jakarta. Only the light and the hour the slider opens on follow it: every figure on
   screen is still the engine's. */
const SHOOT_HOUR = 15;
const JAKARTA = 7;
function shootTime() {
  const jakarta = new Date(Date.now() + JAKARTA * 3600e3);
  jakarta.setUTCHours(SHOOT_HOUR, 0, 0, 0);
  return new Date(jakarta.getTime() - JAKARTA * 3600e3);
}

/* The ffmpeg assemble.py uses, from imageio-ffmpeg: it has libx264. */
const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

const CAPTION = { position: 'fixed', left: '50%', bottom: '56px', transform: 'translateX(-50%)', background: 'rgba(11,12,14,0.88)', color: '#fff', font: '600 34px "Albert Sans", system-ui, sans-serif', padding: '18px 32px', borderRadius: '18px', zIndex: 2147483647, letterSpacing: '-0.01em', maxWidth: '72%', textAlign: 'center', pointerEvents: 'none', boxShadow: '0 12px 40px rgba(0,0,0,.35)', opacity: '0' };

/** One scene's take: the frames kept, the marks between them, and the caption over them. */
class Take {
  constructor(name, page, ctx) {
    this.name = name; this.page = page; this.ctx = ctx;
    this.n = 0; this.marks = []; this.started = Date.now();
    this.cap = { text: '', level: 0, target: 0, bottom: 56, shown: '' };
    this.ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', `raw/${name}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  }
  get t() { return this.n / FPS; }
  mark(label) { this.marks.push({ label, t: this.t }); console.log(`${this.name} ${label} ${this.t.toFixed(2)}  (${((Date.now() - this.started) / 1000).toFixed(0)}s real)`); }
  /** The page's clock moves `ms` and its animation frame runs once. */
  async tick(ms = STEP) {
    await this.ctx.clock.runFor(Math.max(1, Math.round(ms)));
    await this.page.evaluate(() => window.__tick?.());
  }
  /** One frame: a step of the clock, one step of the caption, and the screen kept. */
  async frame() {
    await this.tick();
    const c = this.cap;
    if (c.level !== c.target) {
      const by = 1 / 9;
      c.level = c.target > c.level ? Math.min(1, c.level + by) : Math.max(0, c.level - by);
    }
    const want = `${c.text}|${c.level.toFixed(3)}|${c.bottom}`;
    if (want !== c.shown) {
      c.shown = want;
      await this.page.evaluate(([text, level, bottom, style]) => {
        let el = document.getElementById('__cap');
        if (!el) { el = document.createElement('div'); el.id = '__cap'; Object.assign(el.style, style); document.body.appendChild(el); }
        el.textContent = text; el.style.opacity = String(level); el.style.bottom = `${bottom}px`;
      }, [c.text, c.level, c.bottom, CAPTION]);
    }
    const png = await this.page.screenshot({ type: 'png', timeout: 180000 });
    if (!this.ff.stdin.write(png)) await once(this.ff.stdin, 'drain');
    this.n++;
  }
  async hold(seconds) { for (let i = 0, n = Math.round(seconds * FPS); i < n; i++) await this.frame(); }
  /** Moves the page's clock a frame at a time without keeping frames: to let it settle. */
  async pass(seconds) { for (let i = 0, n = Math.round(seconds * FPS); i < n; i++) await this.tick(); }
  /** Lets real time pass, the page's clock keeping up with it, until `check` says so.
      Nothing is kept: this is how the network is waited for. */
  async until(check, timeout = 120000) {
    const t0 = Date.now();
    let last = t0;
    while (Date.now() - t0 < timeout) {
      const now = Date.now();
      await this.tick(now - last);
      last = now;
      if (await check()) return true;
      await this.page.waitForTimeout(100);
    }
    console.log(this.name, 'gave up waiting after', timeout / 1000, 's');
    return false;
  }
  /** Real seconds passing, with the page's clock keeping up. */
  async wait(seconds) { const end = Date.now() + seconds * 1000; await this.until(() => Date.now() >= end, seconds * 1000 + 1000); }
  /** A rendering update with nothing kept, so observers fire and scroll events land. */
  async peek() { await this.page.screenshot({ type: 'jpeg', quality: 10, clip: { x: 0, y: 0, width: 8, height: 8 } }); }
  /** Puts the page in English. The toggle is in the server's HTML before the page has
      hydrated, and a click before then does nothing, so this presses until the page
      shows `sign`, a line it only shows in English. */
  async english(sign) {
    const en = this.page.getByRole('button', { name: 'EN', exact: true }).first();
    const shown = this.page.getByText(sign).first();
    await this.until(async () => {
      if (await shown.count()) return true;
      if (await en.count()) await en.click({ force: true }).catch(() => {});
      return false;
    }, 60000);
  }
  /** Shows a caption, `bottom` pixels up from the foot of the frame. */
  say(text, bottom = 56) { this.cap.text = text; this.cap.target = 1; this.cap.bottom = bottom; }
  hush() { this.cap.target = 0; }
  /** Scrolls the page to `y` over `seconds`, eased, one frame at a time. */
  async scrollTo(y, seconds) {
    const from = await this.page.evaluate(() => window.scrollY);
    const n = Math.round(seconds * FPS);
    for (let i = 1; i <= n; i++) {
      const k = i / n; const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      await this.page.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event('scroll')); }, Math.round(from + (y - from) * e));
      await this.frame();
    }
  }
  async jump(y) { await this.page.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event('scroll')); }, y); await this.peek(); }
  top(id) { return this.page.evaluate((id) => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + window.scrollY : 0; }, id); }
  async finish() { this.ff.stdin.end(); await once(this.ff, 'close'); console.log(`${this.name}: ${this.n} frames, ${this.t.toFixed(1)}s, in ${((Date.now() - this.started) / 1000).toFixed(0)}s`); }
}

/* Nothing in the landing page says when its model has finished reading the basemap.
   This watches the tile requests instead: quiet() is true once at least `min` tiles have
   answered, none is open, and none has been asked for lately. The app's card carries its
   own mark for the same moment. */
function watchTiles(page) {
  const open = new Set();
  let answered = 0; let last = Date.now();
  const tile = (r) => /mapid\.io\/data\/.*\.pbf/.test(r.url());
  page.on('request', (r) => { if (tile(r)) { open.add(r); last = Date.now(); } });
  const done = (r) => { if (open.delete(r)) { answered++; last = Date.now(); } };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return { quiet: (min = 4) => answered >= min && open.size === 0 && Date.now() - last > 2000 };
}

const browser = await chromium.launch();
const only = process.argv[2] || null;
const log = fs.existsSync('raw/log.json') ? JSON.parse(fs.readFileSync('raw/log.json', 'utf8')) : {};
fs.mkdirSync('raw', { recursive: true });

async function scene(name, fn) {
  if (only && name !== only) return;
  const ctx = await browser.newContext({
    viewport: V, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US', timezoneId: 'Asia/Jakarta',
    // The machine this was shot on sends its HTTPS through a proxy whose certificate
    // Chromium does not trust. Harmless anywhere the certificates are real.
    ignoreHTTPSErrors: true
  });
  await cacheTiles(ctx, path.join(here, '..', 'tilecache'));
  await ctx.clock.install({ time: shootTime() });
  // The installed clock fires an animation frame every sixteen of its milliseconds, so a
  // forty millisecond step would draw every model two or three times for one kept frame.
  // This replaces it: frames queue up, and Take.tick runs the queue exactly once.
  await ctx.addInitScript(() => {
    let id = 0;
    const queue = new Map();
    window.requestAnimationFrame = (cb) => { queue.set(++id, cb); return id; };
    window.cancelAnimationFrame = (k) => { queue.delete(k); };
    window.__tick = () => {
      const due = [...queue.values()]; queue.clear(); const now = performance.now();
      for (const cb of due) { try { cb(now); } catch (e) { console.error(e); } }
    };
  });
  const page = await ctx.newPage();
  const tiles = watchTiles(page);
  const take = new Take(name, page, ctx);
  try { await fn(page, ctx, take, tiles); } catch (e) { console.log('scene error', name, e.message); }
  await take.finish();
  await ctx.close();
  log[name] = { file: `raw/${name}.mp4`, marks: take.marks };
}

/* The cards animate with CSS, which runs on the real clock. Each animation is paused and
   moved to the frame's own time instead. */
async function card(page, take, seconds) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  take.mark('ready');
  for (let i = 0, n = Math.round(seconds * FPS); i < n; i++) {
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), i * STEP);
    await take.frame();
  }
}

await scene('title', async (page, ctx, take) => {
  await page.goto('file://' + path.resolve('cards/title.html'));
  await card(page, take, 6);
});

await scene('landing', async (page, ctx, take, tiles) => {
  await page.goto(base + '/', { waitUntil: 'load' });
  await take.english('How it works');
  // Everything down the page reveals itself on a real-time transition the first time it
  // is scrolled to, and the model section starts reading its catchment the first time it
  // comes near. Scroll through the whole page once now, so the reveals are over and the
  // read is under way before the first frame is kept, then come back up.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 900) await take.jump(y);
  // The street stage holds still for the first tenth of its track and then runs the day
  // as the page scrolls. The beat starts at the end of that hold, with the hero copy
  // still up, and scrolls into the golden hour while the narration asks its questions.
  await take.jump(600);
  await take.wait(1.5);
  await take.pass(3);
  await take.hold(0.5); take.mark('hero'); take.say("Busy, they say. But which corner?");
  await take.hold(0.8); await take.scrollTo(1300, 4.8); await take.hold(2.6);
  take.hush(); await take.scrollTo(await take.top('data'), 1.2); await take.hold(0.3); take.mark('data'); take.say('We count what is really there.'); await take.hold(5.0);
  take.hush(); await take.scrollTo(await take.top('cara-kerja'), 1.2); await take.hold(0.3); take.mark('grid'); take.say('One score per area, for your kind of business.'); await take.hold(4.2);
  take.hush(); await take.scrollTo(await take.top('maket'), 1.2);
  await take.until(() => tiles.quiet(), 180000); await take.wait(2); await take.pass(1); await take.hold(0.5);
  take.mark('maket'); take.say('Any area can be seen as a model.'); await take.hold(5.2);
});

await scene('app', async (page, ctx, take) => {
  await ctx.request.post(base + '/api/auth/login', { data: {} });
  await page.goto(base + '/app', { waitUntil: 'load' });
  // The page opens in Indonesian, and the question box is found by its English label,
  // so the language comes first.
  await take.until(() => page.getByRole('button', { name: 'EN', exact: true }).count(), 120000);
  await take.english('What do you want to open?');
  const box = page.locator('input[aria-label="Ask Tapak"]:visible').first();
  await take.until(() => box.count(), 60000);
  // The map's tiles arrive on the real clock. Give them a few seconds, drawing as they land.
  await take.wait(6);
  await take.pass(1);
  await take.hold(0.5); take.mark('launcher');
  take.say('Ask in your own words.'); await take.hold(0.4);
  await box.click({ force: true }); await take.hold(0.4);
  for (const ch of QUESTION) { await page.keyboard.type(ch); await take.frame(); }
  await take.hold(0.5); await page.keyboard.press('Enter'); take.mark('asked');
  const row1 = page.getByRole('button', { name: /^1 [A-Z]/ }).first();
  await take.until(() => row1.count(), 60000); take.mark('answer');
  await take.hold(2.0); take.say('The best spots, and why.'); await take.hold(3.0);
  take.hush(); await row1.click({ force: true }); take.mark('card');
  await take.hold(1.2); take.say('Open any area and see why.'); await take.hold(4.4);
  // The card reads its model off the basemap once it is open, and says under the model
  // when it is built. Nothing is kept from the wait: the step segment starts at `model`.
  take.hush(); await take.hold(0.4);
  await take.until(() => page.evaluate(() => document.querySelector('.dio .mark')?.textContent?.startsWith('buildings')), 180000);
  await take.pass(0.5); take.mark('model'); await take.hold(1.0);
  // Close on the block first, then out in two steps to the whole disc. The caption sits
  // above the model's own slider here rather than over it.
  await page.getByRole('button', { name: 'Step into this area' }).click({ force: true }); take.mark('step');
  await take.hold(0.6); take.say('Step into the street.', 180); await take.hold(2.2);
  await page.getByRole('button', { name: 'Further out' }).click({ force: true }); await take.hold(1.6);
  await page.getByRole('button', { name: 'Further out' }).click({ force: true }); await take.hold(2.4);
  take.hush(); await page.getByRole('button', { name: 'Leave the model' }).click({ force: true }); await take.hold(0.7);
  await page.getByRole('button', { name: /^Why / }).first().click({ force: true }); take.mark('why');
  await take.hold(1.3); take.say('Every number is real, never made up.'); await take.hold(3.4);
  take.hush(); await take.hold(0.4);
  const dismiss = page.getByRole('button', { name: /Dismiss/ }).first(); if (await dismiss.count()) { await dismiss.click({ force: true }).catch(() => {}); await take.hold(0.5); }
  await page.locator('button', { hasText: /^3D$/ }).first().click({ force: true }); take.mark('3d');
  await take.hold(0.8); take.say('See it in 3D.'); await take.hold(3.2);
  await page.locator('button', { hasText: /^By place$/ }).first().click({ force: true }); take.mark('place');
  await take.hold(1.0); take.say('Pick a real shop to rent, not a hexagon.'); await take.hold(4.6);
});

await scene('closing', async (page, ctx, take) => {
  await page.goto('file://' + path.resolve('cards/closing.html'));
  await card(page, take, 6.5);
});

await browser.close();
fs.writeFileSync('raw/log.json', JSON.stringify(log, null, 1));
console.log(JSON.stringify(log));
