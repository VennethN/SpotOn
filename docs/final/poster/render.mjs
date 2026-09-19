import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1588, height: 2245 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.resolve('poster.html'), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
const report = await page.evaluate(() => {
  const mm = (px) => Math.round(px / 96 * 25.4);
  const out = [];
  for (const s of document.querySelectorAll('section, header')) {
    const name = s.querySelector('h2,h1')?.textContent.slice(0, 28);
    out.push(`${name}: box ${mm(s.clientHeight)}mm, content ${mm(s.scrollHeight)}mm ${s.scrollHeight > s.clientHeight + 1 ? '<<< OVERFLOW by ' + mm(s.scrollHeight - s.clientHeight) + 'mm' : 'ok'}`);
  }
  const pg = document.querySelector('.page').getBoundingClientRect();
  return { page: `${mm(pg.width)}x${mm(pg.height)}mm`, docH: mm(document.documentElement.scrollHeight), out };
});
console.log(report.page, 'doc', report.docH + 'mm'); for (const l of report.out) console.log(' ', l);
await page.pdf({ path: 'SpotOn_Poster_A2.pdf', width: '420mm', height: '594mm', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await page.screenshot({ path: 'poster-preview.png', fullPage: false });
await browser.close();
