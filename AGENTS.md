# Working on SpotOn

SpotOn is a WebGIS that recommends where to open a business around Jakarta's
transit areas. A hexagonal grid is scored per business type from three signals:
how much is spent there, how busy the competitors are, and whether there is
space actually up for rent. You ask in plain language and Tapak, the guide,
answers with the reasons attached.

This file is the working agreement for anyone, human or agent, changing this
repository. `CLAUDE.md` points here so there is only one copy to keep true.

## Commands

```bash
npm run check    # svelte-kit sync + svelte-check. Must be clean before pushing.
npm run build    # production build. CI runs this after check, and blocks deploy on failure.
npm run dev      # local dev server
```

CI (`.github/workflows/ci.yml`) runs typecheck and build on every push and pull
request, then deploys when it lands on `main`. There is no test runner, so those
two commands are the whole safety net. Run both before you push.

## Commits and pushes

Use [Conventional Commits](https://www.conventionalcommits.org/). The subject
line is what the next person reads in `git log`, so make it say what changed and
why it mattered, not which files moved.

```
<type>(<optional scope>): <subject in the imperative>

<optional body explaining the reasoning>
```

Types in use here:

| Type | For |
| --- | --- |
| `feat` | new behaviour a user can see |
| `fix` | a defect that reached the interface or the data |
| `refactor` | same behaviour, different shape |
| `perf` | measurably faster or lighter |
| `style` | copy, spacing, colour, motion, with no behaviour change |
| `docs` | documentation only |
| `build` | dependencies, Vite, adapter, CI |
| `chore` | anything that fits nowhere above |

Useful scopes: `app`, `landing`, `map`, `tapak`, `i18n`, `scoring`, `data`,
`mapid`, `ci`.

```
feat(app): fly the map to the cells Tapak just named
fix(tapak): find the pending turn by id, not by object identity
style(i18n): say what the rent filter does instead of "tight budget"
```

Push rules:

- Never push straight to `main`. Branch, then open a pull request.
- `npm run check` and `npm run build` both pass first.
- Never commit `.env`. `.env.example` carries the shape, never the values.
- One logical change per commit. A copy fix and a data-layer change do not
  belong in the same commit even when you made them in the same sitting.

## Writing rules

These apply to every string a user can read, in **both** languages. They are not
stylistic preferences, they are what keeps the product sounding like one person.

**No em dashes.** Not `—`, anywhere in user-visible copy. Break the sentence in
two, or use a comma. A dash standing in for a missing number is worse still,
because it reads as a minus sign. `$lib/utils/format` exports the agreed
placeholder for an unknown value, which is a middot.

**No semicolons in prose.** If a sentence needs one, it is two sentences. Keep
semicolons where they belong, in code.

**Both languages, always.** `src/lib/i18n/id.ts` defines the shape of the
dictionary and `en.ts` has to fill in that same shape, so TypeScript refuses to
build when a key exists in one and not the other. English is written, not
translated: same voice, not the Indonesian word order carried across.

**Figures come from the data, never from your memory.** Cell counts, transit
nodes, competitor totals and category counts are all read from the grid file's
own metadata (`GridMeta`) or computed from it. Rebuild the grid and every
sentence quoting them follows. A number typed by hand into copy goes stale in
silence, and this has already happened once.

**Say what a control does, not how it feels.** A button labelled "Tight" or
"Reasonably open" tells the reader nothing about what will change. Name the
consequence: "Only where the rent is cheap".

**Never invent a figure, and never dress up an absence.** A cell with no data is
shown as having no data. It is never interpolated, never rounded to zero, and
never quietly dropped from a ranking.

## Where things live

```
src/routes/            pages and API endpoints
  +page.svelte           landing page (prerendered, figures computed in +page.server.ts)
  app/+page.svelte       the map application
src/lib/
  components/app/        surfaces that only exist inside the app
  components/landing/    surfaces that only exist on the landing page
  components/ui/         shared between both
  domain/                scoring, natural-language query, categories, narration
  state/                 app, tapak, lang, theme
  server/source.ts       the one place the data source is decided
  i18n/                  id.ts defines the shape, en.ts fills it
  scene/                 three.js diorama and daylight
  utils/                 format, geo, motion (springs)
```

Two rules hold this apart: the UI never reaches past `server/source.ts` for
data, and `domain/` never imports from `components/`.

## Data and environment

Copy `.env.example` to `.env` and fill it in.

| Variable | What it does |
| --- | --- |
| `OPENROUTER_API_KEY` | language understanding. Without it the app still works, questions fall back to the rule parser, and every figure is still computed by the scoring engine. |
| `OPENROUTER_MODEL` | optional model override |
| `PUBLIC_MAPID_STYLE_URL` | the MAPID MAPS style **URL**. A bare style id is rejected and the open raster basemap is used instead, with a warning in the console. |
| `MAPID_API_KEY` | read by the data scripts, not by the application |

The model only ever chooses an operation and fills in its arguments. Every
number a user sees is computed by `domain/scoring.ts`, on data. That boundary is
the product's whole claim to being trustworthy, so do not move work across it.

## Regenerating the data

Every data file says how to rebuild it, in a `regenerate` field in its own
metadata. The order matters, because each step reads what the one before it
wrote.

```bash
node scripts/fetch-mapid.mjs     # → src/lib/data/mapid-poi.json   needs MAPID_API_KEY
node scripts/join-mapid.mjs      # → adds mapid + covered to hexes.json   needs Overpass
node scripts/build-pois.mjs      # → static/data/pois/<category>.json   local only
node scripts/fetch-property.mjs  # → src/lib/data/mapid-property.json   needs MAPID_API_KEY
node scripts/join-property.mjs   # → adds prop + propCovered to hexes.json   local only
node scripts/build-property.mjs  # → static/data/property.json   local only
node scripts/build-stops.mjs     # → static/data/stops.json   needs Overpass
node scripts/build-routes.mjs    # → static/data/routes.json  needs Overpass
```

`join-property.mjs` has to run after `join-mapid.mjs`, not before. It decides coverage
per administrative city and reads the city each cell sits in from the cell itself, which
is what the MAPID join wrote there. Run it on a grid that has never been through that
step and it covers nothing, which it says and then stops rather than writing zeroes.

**Competitors on the map are named, and this is what keeps them named.** The map
labels a competitor with its own name the same way it labels a station. That
came from the MAPID features' `NAMA` column, which `fetch-mapid.mjs` keeps and
`build-pois.mjs` writes into the third slot of each point. All 24,630 points
carry one.

It was not always so. The file was once written before `NAMA` was kept, and
every competitor on the map was drawn bare for as long as that lasted. What
brought them back was this pair, and it is the pair to run again if the names
ever go missing:

```bash
MAPID_API_KEY=… node scripts/fetch-mapid.mjs && node scripts/build-pois.mjs
```

`join-mapid.mjs` is not in that pair on purpose. Names change no count, so
nothing needs rejoining, and that step needs Overpass as well as a key. Run it
only if the point set itself changed.

Whether the names are there is read from the data, never assumed. Each category
file carries a `named` count beside its `count`, `build-pois.mjs` prints the two
side by side on every run, and the panel falls back to saying a cell's
competitors have no names rather than leaving the marks looking like a label
layer that failed. A rebuild that quietly drops `NAMA` therefore shows up as a
number, in the place the number is already being read.

There is no setting for this in the application.

`npm run selftest` covers the parts of this that a rebuild cannot: the score
breakdown against the scoring engine, the competitor pipeline including the
absent-name rules, which the real data no longer exercises now that every point
in it has a name, the cost-of-space layer against the grid on disk, and which
measure each kind of question is understood to be asking about.

## Questions are a shape and a measure, chosen separately

`domain/metrics` lists every figure a question can be about. The understanding layer
picks one of those keys plus an intent, and the two vary independently: "where should I
open", "where is it busiest" and "where is space cheapest" are all rankings, and the
measure is the only thing that differs. They were not separate once, and the result was
that "seberapa ramai di sini" came back as an opportunity score.

Add a measure in `domain/metrics` and it reaches the model's tool schema, the fallback
parser, the sort, the filters and the answer sentence together. Two things are load
bearing:

- A filter names a **band**, never a threshold: `rendah`, `tinggi` or `ada`. The bands
  are the grid's own terciles, computed when the query runs. There is deliberately no
  way for the understanding layer to say "under 30 million", because that number would
  be the only figure in the answer that came from nobody's data.
- `read` returns null where a cell was never measured, and a null is DROPPED from a
  ranking rather than sorted to the bottom of it. An unsurveyed catchment at the top of
  "fewest competitors" is indistinguishable from a real finding, which is the same
  mistake as reading an unsurveyed count as zero.

## Two pivots: the area, and the place standing in it

`domain/units` is the second one. Everything else ranks catchments, which is the right
shape for "where should I open" and the wrong shape for what a reader does next, because
nobody rents a hexagon. In unit mode each unit on the market is a row and its catchment
travels with it as context.

The rule that makes it work is that **each unit gets exactly one home cell**, the nearest
centre within the walking radius. That is deliberately NOT the rule `join-property.mjs`
uses: the join counts a listing into every catchment that reaches it, which is correct
for a count and fatal for a list — the same shophouse would appear five times with five
different scores beside it. A unit with no cell centre in range is dropped rather than
handed the figures of a cell it cannot walk to.

Everything else follows the rules the cell pivot already follows. Filters are bands
(thirds of the current set), never thresholds. A unit with nothing measured for the
sorted figure is dropped from the ranking, not sorted to the bottom of it.

One thing the data forced, and it is worth knowing before changing the default sort:
every listing carries a total asking price, and only half carry a price per m². Sorting
cheapest-first leads with the least trustworthy rows — a "Komersial lain" asking Rp 100
juta, a kiosk on 6 m² — so the list opens on the home cell's score instead.

## Small talk is allowed, and fenced in code

Tapak can say hello, say what SpotOn is, and talk generally about running a small
business. It could not before, and a greeting met with "that is outside what I can
answer" reads as broken rather than rigorous.

This is the one place the model writes a sentence the reader sees, which makes it the
one place a fabricated figure could get in. "Warteg biasanya balik modal dalam 8 bulan"
is fluent, plausible, entirely invented, and would sit in the same thread as figures
that are traceable to a source. So `domain/chat` enforces what the prompt asks for:

- **No digits.** Any digit at all, and the reply is thrown away rather than repaired,
  replaced by this interface's own canned line for the topic. Blunt on purpose — a
  clever rule grows exceptions, and the first exception is where "sekitar 8 bulan" gets
  through. A rejected "24 jam" costs one canned sentence; the alternative costs trust.
- **Two sentences, three topics.** Anything outside greetings, what SpotOn is, and
  general business talk still goes to "I cannot answer that from this data".
- **The map never moves.** No items, no highlight, no category change. `query` on a
  chat turn is only the fallback parser's reading of the sentence, and it will happily
  find "warteg" inside "makasih, warteg emang enak".

Without a model key only greetings are reachable, by rule, and a greeting counts only
when it is the whole message: "oke berapa harga tempat di sini" is a question with a
courtesy in front of it, and answering it with hello throws away what was asked.

## What space costs, and the word this product will not use

MAPID's premium catalogue has no rent for Jakarta. That is a measurement, not a guess:
`fetch-property.mjs` reads every property dataset published for the province and tallies
the sale-or-rent column on every run, 30,629 rows across 83 datasets, and the answer
comes back a sale every time. 176 rows do carry the word SEWA, all of them inside the
advertising copy in `ALAMAT` ("DI JUAL SEWA APARTEMEN KEMANG MANSION FULL FURNISHED"),
which is why that column is not carried into the app at all.

So the cost signal is an **asking price to buy**, and it is called that everywhere it
travels: `price`, `pricePerM2`, `costFactor`, never `rent`. A monthly rent could be
produced from it with a yield assumption. It is not, because that assumption would be
the only figure on the screen that came from nobody's data, in a product whose whole
claim is that its figures do not.

The tally is recomputed rather than written down, and `selftest-property.mjs` asserts on
it, so the day MAPID publishes a SEWA row the test fails and says the interface is now
wrong. That is the intended way to find out.

Two rules follow from the same place as the rest of this file:

- The multiplier never goes above 1. A catchment nobody has priced is multiplied by
  exactly 1, and the panel says which of five reasons that is. Treating it as
  median-priced instead would put an invented price on an unsurveyed place and let it
  move a ranking.
- A median is read from at least three priced units, and a catchment is ranked only
  against a grid carrying at least eight prices. The listings hold real errors, a ruko
  at Rp 9.6 billion per m² among them, and one of those alone in a catchment would cost
  it a quarter of its score on the strength of a typo.
