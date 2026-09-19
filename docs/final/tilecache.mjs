import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Answers the browser's requests to MAPID's tile server from a cache on disk, fetching
 * each one once, with retries.
 *
 * The machine these materials were shot on reaches the tile server through a proxy
 * that now and then fails a request outright. The app treats a failed read as final,
 * which is right for a reader and fatal for a take: one dropped tile leaves a model
 * bare for the whole recording. Behind this every tile, style, manifest and glyph is
 * fetched with up to four attempts and then kept, so a second take needs no network
 * at all and every take sees the same basemap.
 *
 * Only for recording. The app itself is not changed by it.
 */
const HOST = /^https:\/\/v2\.basemap\.mapid\.io\//;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function cacheTiles(ctx, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const keyOf = (url) => path.join(dir, crypto.createHash('sha1').update(url).digest('hex'));
  await ctx.route(HOST, async (route) => {
    const url = route.request().url();
    const key = keyOf(url);
    try {
      if (fs.existsSync(key + '.json')) {
        const meta = JSON.parse(fs.readFileSync(key + '.json', 'utf8'));
        const body = meta.status === 204 ? '' : fs.readFileSync(key);
        return await route.fulfill({ status: meta.status, headers: meta.headers, body });
      }
      let last = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await route.fetch({ timeout: 90000 });
          const status = res.status();
          if (status >= 500) throw new Error(`HTTP ${status}`);
          const body = status === 204 ? Buffer.alloc(0) : await res.body();
          const headers = {
            'content-type': res.headers()['content-type'] || 'application/octet-stream',
            'access-control-allow-origin': '*'
          };
          fs.writeFileSync(key, body);
          fs.writeFileSync(key + '.json', JSON.stringify({ url, status, headers }));
          return await route.fulfill({ status, headers, body });
        } catch (e) {
          last = e;
          if (/aborted|closed|detached/i.test(String(e))) return;
          await sleep(700 * attempt);
        }
      }
      console.log('tile cache: giving up on', url.replace(/\?key=.*/, ''), String(last).slice(0, 80));
      await route.abort();
    } catch {
      // The page has moved on from this request. Nothing to answer.
    }
  });
}
