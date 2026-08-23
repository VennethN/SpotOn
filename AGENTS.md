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
| `PUBLIC_MAPID_MAP_KEY` | the MAPID MAPS **Map Service key**. The style URL is built from it, and the light or dark style is picked to match the reader's theme. |
| `PUBLIC_MAPID_STYLE_URL` | a full style **URL**, for a style the app does not know about. Wins over the key, and pins one style regardless of theme. A bare key here is rejected, with a warning naming the variable it belongs in. |
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
node scripts/fetch-hours.mjs     # → src/lib/data/osm-hours.json   needs Overpass
node scripts/join-hours.mjs      # → adds hours to hexes.json   local only
node scripts/build-hours.mjs     # → static/data/hours.json   local only
node scripts/build-stops.mjs     # → static/data/stops.json   needs Overpass
node scripts/build-routes.mjs    # → static/data/routes.json  needs Overpass
node scripts/fetch-missions.mjs  # → src/lib/data/mission.json   no key needed
node scripts/join-missions.mjs   # → adds field to hexes.json    local only
node scripts/build-field.mjs     # → static/data/field.json      local only
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

The three opening-hours steps run in that order and depend on nothing but the grid
having cells. `join-hours.mjs` needs no city assignment, unlike the property join: one
Overpass query covers the whole grid at once, so there is no city that might not have
been read.

`npm run selftest` covers the parts of this that a rebuild cannot: the score
breakdown against the scoring engine, the competitor pipeline including the
absent-name rules, which the real data no longer exercises now that every point
in it has a name, the cost-of-space layer against the grid on disk, the
opening-hours reader and every cell's activity count against the point file the
curve is drawn from, which measure each kind of question is understood to be
asking about, and the field surveys against the two files they produced.

## The field surveys are evidence, and they never reach the score

`scripts/fetch-missions.mjs` reads the three competition surveys, Struk Go, Menu
Go and Properti Go, plus the community notes filed beside them. They are not in
the premium catalogue and not in the layer index, and looking for them there is
what the script this replaced spent its life doing. MAPID Apps serves them from
its own public endpoints, which need no key, no project and no layer id.

They are a different KIND of data from everything else here, and the difference
decides how they are used. OpenStreetMap and the MAPID catalogue claim
completeness for the city they cover, which is what makes a zero from them a
finding. These are surveys somebody walked. 191 of the 562 catchments carry a
record, and the other 371 are not quiet streets, they are streets nobody has
been down.

So three rules hold, and `selftest-field.mjs` asserts all of them:

- **Nothing in `field` enters `scoreOne`.** It rides along the row as evidence
  beside the score. Folded into the arithmetic, "nobody went here" would be
  identical to "nothing happens here".
- **A cell nobody visited has no `field` key**, never a row of zeroes. The two
  askable measures read null there, so those cells are dropped from a ranking
  rather than filling the whole of "fewest receipts".
- **Counts come from one record, shares and medians need three.** A count of one
  is exactly true. "Everyone here pays by QRIS" off one receipt is a claim about
  one afternoon, and the threshold is the property join's, recorded in the grid's
  metadata rather than written into the sentence.

Every label a reader sees says RECORDED, and the panel says outright that this
is not a census. This is also the only rent in the product: the premium
catalogue publishes none for Jakarta, the property form asks a different
question, and some of its records answer Disewa. What the form never asks is the
price, and the interface says that too.

One rule about the join, because it is the opposite of `join-property.mjs`':
**each record gets exactly one home cell**, the nearest centre within the walking
radius. That join counts a listing into every catchment that reaches it, which is
right for a density and fatal for a list, because these records get listed by
name. The rule lives in `scripts/lib/home-cell.mjs` so the join that counts and
the build that lists cannot come to disagree.

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

## Where things live, and which way the arrows point

```
types.ts        the shapes and the key unions. The leaf: imports nothing from src.
utils/          format, geo. Depend on nothing.
domain/         the engine. Pure functions over the types. No Svelte, no DOM, no fetch.
map/            what the map is given to draw. Depends on domain + state, not on MapLibre.
state/          the runes. Owns what the reader has chosen and what has been fetched.
components/     the pixels.
server/         the data source and the model layer. Never imported by the client.
i18n/           every user-visible string, in both languages.
```

The rule is that the arrows only point downwards. `types.ts` in particular imports
nothing from `src` — it briefly imported two key unions back from `domain/`, and a
type-only cycle is still a cycle: the module everything depends on had come to depend on
two modules that depend on it. Key unions (`CategoryKey`, `MetricKey`, `UnitMetricKey`,
`PropertyType`, `ChatTopic`) are declared there; the tables that give them meaning live
in the domain, as `Record<Key, …>` so a key without a definition is a compile error.

Two shared pieces worth knowing before writing a third copy of either:

- `domain/rank` holds ranking and band-filtering for BOTH pivots. What varies between a
  catchment and a unit is the row type and the list of measures; the rules — bands are
  thirds of the current set, unmeasured rows are dropped rather than sorted last,
  filters compose in order — are the same rules, and were written twice before they were
  written once.
- `map/sources` holds every GeoJSON builder. They were methods on `MapView`, closing over
  its `app`, `c`, `heat` and `cssVar`, which is how that file reached 1,855 lines. What
  goes on the map is the thing feature work changes, and it should be readable without
  the layer definitions, event wiring and marker bookkeeping around it.

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

## When the doors are open, and the other word this product will not use

The area panel draws a chart shaped exactly like Google's popular times. It is a
different measurement, and that difference is the whole of why it can be shown here.

Google counts phones. This counts DOORS: for each hour of each day, how many businesses
within walking range say they are open, read from the `opening_hours` tag in
OpenStreetMap. Nobody has counted a person in Jakarta for this product, so the section
never says ramai, busy, popular or footfall, and it says what it counts on screen rather
than only in this file.

Struk Go and Mission Go are what would carry the other half, because a receipt is the
demand side of the same hour. Neither exists yet, which `fetch-mission.mjs` re-checks on
every run rather than letting the absence quietly become an assumption. When they arrive
the two go side by side, and until then neither is renamed to sound like the other.

Three rules hold it up. They are the property layer's rules with different nouns:

- **A refused timetable is refused whole.** `opening_hours` is a small language and
  `scripts/lib/hours.mjs` reads a deliberately narrow part of it: weekday selectors,
  clock ranges, `off`, `24/7`, spans past midnight. A public holiday clause, an hour
  that moves with the sunset, a rule that only holds in July, a comment where a time
  should be: the value is rejected BY NAME, counted under that name, and never read down
  to the half that fitted. Reading the readable half of `Mo-Fr 09:00-17:00; PH off` is
  harmless, and the same leniency applied to a seasonal rule reports the winter
  timetable all year. It costs 82 of Jakarta's 3,156 published timetables, 2.6%, and it
  is what makes the other 97.4% worth drawing.
- **A curve needs eight readable businesses.** Three shops are three timetables, not a
  rhythm, and one 24-hour minimart among them draws a street that never sleeps. 202 of
  the 562 cells clear it, 296 are too thin and 64 have nothing at all, and each of those
  three says which it is. The distribution the threshold was picked against is written
  into the grid's metadata (`hours.perCell`) so the number can be argued with from the
  data rather than defended from memory.
- **The denominator travels with the curve.** Only 3,156 of the 19,548 businesses
  counted publish hours at all. A chart with no count beside it reads as the whole
  street, so `join-hours.mjs` stores three figures per cell per radius — businesses
  counted, businesses publishing, timetables readable — and the panel prints them under
  every curve it draws.

What counts as a business is a list of EXCLUSIONS, in `NOT_A_BUSINESS` in
`fetch-hours.mjs`: every `shop`, `craft`, `office` and `amenity`, minus unattended
fixtures, institutions and public offices. An inclusion list was the first attempt and
it was the wrong shape, because a list of the amenity values somebody thought of
silently discards the ones they did not. The cull is real either way: 410 of the 2,335
Jakarta amenities publishing opening hours are cash machines, and a hole in the wall is
not a competitor.

The week itself is NOT in the grid. Seven days of 24 hours per cell per radius is
470,000 figures on a grid file that is 674 KB carrying only the counts, so the
timetables travel with the businesses in
`static/data/hours.json` (88 KB, 474 distinct timetables between 3,074 businesses) and
the browser adds up the ones a cell captures. That is the split `domain/premises` makes
for the property listings, for the same reason.

Two passes over two files, and the panel prints the first above a chart drawn from the
second, so `selftest-hours.mjs` checks that they agree on every cell at every radius. It
already earned that: the join used the mean earth radius while `utils/geo` uses the
WGS84 equatorial one, 0.11% apart, which put one shop inside 400 m on one side of the
comparison and outside it on the other. The join now measures with the same earth the
browser does. **The other join scripts still use the mean radius**, which is harmless
there only because nothing recounts their work in the browser.


## One earth, and why it took three goes to get there

Every script that measures a distance imports `haversine` from `scripts/lib/geo.mjs`,
and that file holds the only earth radius in the repository. It is `6378137`, the WGS84
equatorial radius, because that is what `src/lib/utils/geo.ts` measures with and the
browser is the side a reader actually sees.

It was not always one. The joins each carried their own copy opening
`const R = 6371008.8`, the mean radius, and `lib/home-cell.mjs` arrived later with a
third, `6_371_000`. The three differ by about a tenth of a percent, which is 0.9 m at an
800 m radius and invisible right up until two of them measure the same thing:

- **21 property readings** disagreed with what the browser recounts, by as many as 7
  listings at once, because the catalogue geocodes to the street and one coordinate on
  the line carries several units.
- **93 cells** were wrong on their MAPID competitor count, by as many as 3.
- **The opening-hours layer** disagreed on one cell, which is how the whole thing was
  found: `selftest-hours.mjs` compares the two passes on every cell at every radius.
- **The field records** were untouched, because a record's home cell is decided once at
  build time and the browser never recounts it. That is luck rather than design, and
  `selftest-field.mjs` now asserts `home-cell.mjs` uses the shared function rather than
  a copy, so the luck is not needed twice.

Two tests hold it: `selftest-property.mjs` checks the scripts and the app return the
same DISTANCE rather than merely declaring the same constant, and `selftest-field.mjs`
checks the home-cell rule has not grown its own again. `build-hexes.mjs` was switched
over but not re-run, since nothing recounts its output and its transit counts were
measured identical under both radii.

## The fetch box is the grid plus one radius, and the pad is checked

Every fetch that answers "what stands within reach of a cell" is bounded by the grid's
own extent PADDED by one walking radius, from `gridExtent` in `scripts/lib/geo.mjs`.
Read from the grid rather than typed in, so it follows the grid if that moves, and
shared so two fetches cannot pad differently and then disagree about which records
exist.

The pad is not decoration. A cell's catchment reaches a full radius past its own centre,
and three cells sit closer to the edge than that — all three at Soekarno-Hatta, the
nearest 32 m from it — so an unpadded fetch left up to 768 m of their catchment unread.
`fetch-missions.mjs` had the rule first and it was right; `fetch-hours.mjs` did not and
was refetched over the padded box.

Then the pad itself was five metres short, because it divided by 111,320 m per degree of
latitude when the shortest a degree gets is 110,574. A pad short by any amount is not a
guarantee, so it now uses the shorter figure with 1% on top and `selftest-hours.mjs`
asserts the result: no catchment may reach past the box that was fetched. It currently
clears it by 8 m at Jatimulya, which is the tightest cell on the grid.

What the padding bought in data was almost nothing — one business, in one cell in Depok.
The ground past the western edge is airport apron and water. That is the honest outcome
and it is not the reason to keep the rule: the reason is that the next time the grid
moves, nobody has to rediscover which cells sit on the edge.

`build-hexes.mjs` pads its COMPETITOR queries the same way, through `POI_BBOX`, while
its transit query keeps the raw `BBOX` — that one decides where cells exist at all, and
padding it would invent cells nobody asked for. It has not been re-run, so its counts
move on the next rebuild rather than now.

Two scripts learned a related lesson the hard way while this was being done.
`fetch-missions.mjs` and `build-hexes.mjs` both ran their whole job on IMPORT, so
reaching for one exported helper started a network fetch and rewrote committed data.
Both now carry the same run guard every other script in that directory has.
