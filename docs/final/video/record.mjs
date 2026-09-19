import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const base = 'http://127.0.0.1:5173';
const V = { width: 1920, height: 1080 };
const browser = await chromium.launch();
const only = process.argv[2] || null;
const log = fs.existsSync('raw/log.json') ? JSON.parse(fs.readFileSync('raw/log.json', 'utf8')) : {};
async function scene(name, fn) {
  if (only && name !== only) return;
  const ctx = await browser.newContext({ viewport: V, deviceScaleFactor: 1, recordVideo: { dir: 'raw', size: V }, colorScheme: 'light', locale: 'en-US' });
  const page = await ctx.newPage();
  const t0 = Date.now(); const marks = [];
  const mark = (label) => { marks.push({ label, t: (Date.now() - t0) / 1000 }); console.log(name, label, ((Date.now() - t0) / 1000).toFixed(2)); };
  const cap = (t) => page.evaluate((t) => {
    let el = document.getElementById('__cap');
    if (!el) { el = document.createElement('div'); el.id = '__cap'; document.body.appendChild(el);
      Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '56px', transform: 'translateX(-50%)', background: 'rgba(11,12,14,0.88)', color: '#fff', font: '600 34px "Albert Sans", system-ui, sans-serif', padding: '18px 32px', borderRadius: '18px', zIndex: 2147483647, letterSpacing: '-0.01em', transition: 'opacity .35s', maxWidth: '72%', textAlign: 'center', pointerEvents: 'none', boxShadow: '0 12px 40px rgba(0,0,0,.35)', opacity: '0' }); }
    el.style.opacity = t ? '1' : '0'; if (t) el.textContent = t;
  }, t);
  try { await fn(page, ctx, mark, cap); } catch (e) { console.log('scene error', name, e.message); }
  const video = page.video();
  await ctx.close();
  const p = await video.path(); const out = `raw/${name}.webm`; fs.renameSync(p, out);
  log[name] = { file: out, marks };
}
await scene('title', async (page, ctx, mark) => {
  await page.goto('file://' + path.resolve('cards/title.html')); await page.evaluate(() => document.fonts.ready); mark('ready'); await page.waitForTimeout(6000);
});
await scene('landing', async (page, ctx, mark, cap) => {
  await page.goto(base + '/', { waitUntil: 'load' }); await page.waitForTimeout(3000);
  const en = page.getByRole('button', { name: 'EN', exact: true }).first(); if (await en.count()) await en.click();
  await page.waitForTimeout(600); mark('hero'); await cap("Around Jakarta's stations, location is still guesswork.");
  await page.mouse.move(960, 540);
  for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 18); await page.waitForTimeout(120); }
  await page.waitForTimeout(3200);
  await cap(null); await page.evaluate(() => document.getElementById('data')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); await page.waitForTimeout(1400); mark('data'); await cap('562 walkable cells, counted one by one.'); await page.waitForTimeout(5200);
  await cap(null); await page.evaluate(() => document.getElementById('cara-kerja')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); await page.waitForTimeout(1400); mark('grid'); await cap('One score per cell, per business type.'); await page.waitForTimeout(5200);
});
await scene('app', async (page, ctx, mark, cap) => {
  await ctx.request.post(base + '/api/auth/login', { data: {} });
  await page.goto(base + '/app', { waitUntil: 'load' }); await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'EN', exact: true }).first().click(); await page.waitForTimeout(1200); mark('launcher');
  await cap('Ask Tapak, the AI guide, in plain language.');
  const box = page.locator('input[aria-label="Ask Tapak"]:visible').first();
  await box.click(); await page.waitForTimeout(400);
  await box.pressSequentially('Where should I open a coffee shop near a station?', { delay: 42 });
  await page.waitForTimeout(500); await box.press('Enter'); mark('asked');
  await page.getByRole('button', { name: /^1 / }).first().waitFor({ timeout: 20000 }); mark('answer'); await page.waitForTimeout(2500); await cap('The map recolours with the answer.'); await page.waitForTimeout(3500);
  await cap(null); await page.getByRole('button', { name: /^1 / }).first().click(); mark('card'); await page.waitForTimeout(1200); await cap('Open any area and see why.'); await page.waitForTimeout(4800);
  await page.getByRole('button', { name: /^Why / }).first().click(); mark('why'); await page.waitForTimeout(1500); await cap('Every figure is computed from the data, never by the model.'); await page.waitForTimeout(8000);
  await cap(null); const dismiss = page.getByRole('button', { name: /Dismiss/ }).first(); if (await dismiss.count()) { await dismiss.click().catch(() => {}); await page.waitForTimeout(500); }
  await page.locator('button', { hasText: /^3D$/ }).first().click({ force: true }); mark('3d'); await page.waitForTimeout(800); await cap('Switch to 3D.'); await page.waitForTimeout(4200);
  await page.locator('button', { hasText: /^By place$/ }).first().click({ force: true }); mark('place'); await page.waitForTimeout(1200); await cap('Or rank the premises actually on the market.'); await page.waitForTimeout(5000);
});
await scene('closing', async (page, ctx, mark) => {
  await page.goto('file://' + path.resolve('cards/closing.html')); await page.evaluate(() => document.fonts.ready); mark('ready'); await page.waitForTimeout(6500);
});
await browser.close();
fs.writeFileSync('raw/log.json', JSON.stringify(log, null, 1));
console.log(JSON.stringify(log));
