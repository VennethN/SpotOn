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
  components/account/    surfaces that only exist on the account page
  components/ui/         shared between them
  domain/                scoring, natural-language query, categories, narration, markdown
  state/                 app, tapak, lang, theme, account
  server/source.ts       the one place the data source is decided
  server/gridmap.ts      where each cell is on the page, for every page that draws one
  server/answer.ts       one question answered, in one place, for both reply shapes
  server/mongo.ts        the one place "is there a database" is answered
  server/accounts.ts     accounts, sessions and the meters, over Mongo or over memory
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
| `PUBLIC_MAPID_STYLE_URL` | a full style **URL**, for a style the app does not know about. Wins over the key, and pins one style regardless of theme. A bare key left in here is read as a key, because this is where the key used to go. |
| `MAPID_API_KEY` | read by the data scripts, not by the application |
| `MONGODB_URI` | where accounts, sessions and quotas are stored. **Empty means demo mode**, which is a supported way to run this rather than a broken one: one account, one button to sign in, records in memory. See "Two metered actions" below. |
| `MONGODB_DB` | optional database name inside that cluster. Empty means `spoton`. |

The model only ever chooses an operation and fills in its arguments. Every
number a user sees is computed by `domain/scoring.ts`, on data. That boundary is
the product's whole claim to being trustworthy, so do not move work across it.

## Two metered actions, and one of them is not the model

There are exactly two things an account is charged for, and they were chosen the same
way everything else here is: by what actually costs something to produce.

- **One question to Tapak.** Understanding a sentence means a call out to a shared model,
  which is the expensive half of this product and the half that can take ninety seconds.
- **One area or one unit opened by hand.** That is the moment the whole apparatus around
  one place runs: its competitors located and named, the stations it captures read, the
  listings standing in it gathered, its timetables added up into a curve.

What is deliberately NOT metered is the map. Panning it, colouring it, switching business
type, moving the radius, reading the legend: all free, all of it computed in the browser
from a grid it already has. A product that charged for looking at the map would be
charging for the thing it is, and the reader would spend the whole session deciding
whether to move.

Three rules hold the second meter up, and they are the ones a reader would notice being
broken:

- **Closing costs nothing, and reopening what is already open costs nothing.** Two clicks
  on one hexagon are one reading of it. Somebody who taps twice because the first tap did
  not look like it registered must not pay twice for finding that out.
- **Only what the reader did.** A catchment Tapak opens as part of an answer is not
  charged. `select` and `selectUnit` are the only doors, and every programmatic move
  inside `AppState` assigns the field directly rather than going through them.
- **The server is the meter.** The browser keeps a copy so the figure on screen is right
  before the network is, and it spends against that copy first so a card opens on the
  frame it was clicked. What actually counts is `spendMeter`, and it guards its write on
  the numbers it made the decision from, so two tabs cannot buy the same last reading
  twice.

The AI meter is spent inside `POST /api/ai/query`, before the model is called and not
after it answers. A question that goes out and comes back empty was still asked, and
charging only for the answers would let a question be re-asked for nothing until one came
back. So the browser learns what a question cost by re-reading the balance once the turn
is over: no figure is ever put into the answer stream, which is the same rule that keeps
every other figure out of it.

The allowances themselves live in `domain/plans` and NOWHERE else. Not one is typed into
a sentence: every string in `i18n` takes them as arguments, so raising a tier changes the
pricing page, the account card, and the sentence somebody reads when they run out, in one
edit. It is the grid-metadata rule applied to prices, and for the same reason, since a
pricing page carrying a stale figure is the worst place in the product for one to be.

The week turns at midnight on Monday **in Jakarta**, fixed, because Western Indonesian
Time has no daylight saving to move it and the server's own zone would move the boundary
with whichever region a deploy landed in. An account that has been quiet for a month
comes back to ONE week, not to the four it slept through: an allowance is a rate, not a
debt somebody is owed. What was bought outright survives every Monday, which is the whole
difference between a top-up and a plan. `selftest-plans.mjs` asserts all of it against the
table actually in the repository, including that the ladder is monotonic in both price
and allowance on every meter, because a tier that costs more and grants less on one of
them is a pricing page arguing with itself.

## Nothing on the account page is a picture of a legible number

Five things are drawn there and each does something its own caption cannot. A meter
turns a remainder into a PROPORTION, because "1,480 left" is a quantity and the
question a reader has is whether that is most of the week or the end of it. The week
strip turns a refill date into a POSITION, because a date has to be held against
today's date and seven cells with today marked do not. The crests turn a tier into a
RANK at a size no wording is legible at, so the cards are told apart while they are
scanned. The catchment field turns "1,500 areas a week" into the CITY, because that is
an allowance nobody can picture and 562 hexagons where they really are is one. And the
model in the head is the grid as an OBJECT, which is the one thing on the page that
says what these plans are plans for.

Two of those read real figures off the grid on disk. The field is every cell at its
real centre, coloured by the trade standing around it; the model is ninety-one of those
readings sampled evenly across the ranking. Both go through `server/gridmap`, which the
landing page uses too, so no two pages can come to disagree about where a cell is.

**The measure is TRADE, never an opportunity score.** Nobody choosing a plan has named
a business type, and a score without one is a score for a business the reader never
mentioned. Trade is what the map itself paints before anything has been asked, so the
page and the app's opening screen say the same thing. It is also why the account page
does NOT reach for `DEFAULT_CATEGORY`: that constant survives for exactly one place, the
illustration on the way down the landing page, and a second caller would make it two.

**One three-dimensional object per page.** The model stands in the head and the
catchment field below it is deliberately flat. The landing page settled that the hard
way: a second slab competing with the first made both look like decoration.

Tapak stands beside the account's own name. It is the same figure that walks the diorama
and answers on the map, and an account page is where a product is most tempted to
introduce a stranger instead.

There were four. Each tier card also carried a thin bar under its allowance, filled in
proportion to the largest tier, so the ladder could be seen rather than worked out. The
first person who saw it read it as USAGE, on three plans at once, which is impossible:
an account holds one plan. **Do not put that back.** Two things went wrong and both are
worth knowing before drawing anything else on this page. A bar chart needs its bars in
one frame to read as a comparison, and split one per card there are no peers in view, so
a lone bar in a track is a gauge. And the reader had learned that exact mark two sections
above, where it genuinely is their balance, so the page taught one meaning and
immediately reused it for another. The rank is carried by the crests and the size by the
figures, and neither can be mistaken for a meter.

**One mark, one meaning, per page.** A track with a fill means "what is left of your
allowance" and it may not mean anything else here.

The rules those drawings are held to are the rules the rest of the product already
follows, applied to a page about money:

- **Every figure comes from `domain/plans`.** Not one allowance and not one price is
  written into the copy or into a component. Even the crest counts its hexagons off the
  tier's position in `PLAN_KEYS` rather than off a number, so inserting a tier moves the
  whole page at once.
- **Decoration is uniform, and a map is labelled.** `HexField` is a lattice at one
  weight with no fill, because a decoration with one cell darker than another would be a
  map of nothing. `CatchmentField` is the opposite case and is allowed to be a map: every
  position is a real centre and every colour a real count, so it carries a legend and
  says what it is coloured by. The test is not whether hexagons are involved, it is
  whether anything varies.
- **A cell nobody counted is drawn as an absence.** An outline with nothing in it, on
  both the field and the model. The bottom step of the ramp would say the street was
  quiet, and 100 of the 562 sit in cities the catalogue has never read.
- **The week strip is a calendar, not a chart.** Nothing is stored per day, so no cell is
  weighted differently from another. Cells differ only in whether the day has been
  reached.
- **The sections arrive on mount, not on scroll.** `Reveal` waits to be scrolled to,
  which is right for a landing page read top to bottom and wrong for a page somebody
  opened to check one figure. It cost the top-ups their whole section once.
- **The model arrives once and then holds.** Nothing loops. Its columns are fixed
  readings, and a field that rose and fell on a timer would be a picture of values
  changing. An entrance reveals a reading; an idle animation invents one.

Two details worth keeping. The large figure is the TOTAL a reader can spend, because
that is what the chip in the map chrome shows and two surfaces printing different
totals for one account is worse than either being harder to read; the bar under it is
this week's allowance alone, labelled as such, because credits bought outright have no
weekly grant to be a fraction of. And an empty meter has to LOOK empty: its track is
kept faint, since with no fill left the track is the only bar on screen and a heavy one
reads at a glance as a bar that is full.

## No database is a way of running this, not a failure to configure it

`MONGODB_URI` empty means demo mode. There is one account, signing in is a single button
with no password, and the records live in a Map in the process until it restarts.

Everything else is identical, and that is the rule this is held to: the same three tiers,
the same weekly allowances, the same two meters counting down, the same session tokens,
the same scrypt derivation on any password there is. `server/accounts.ts` branches on
storage and on nothing else, because a branch that reached further would let the demo
pass while the real thing was broken, which is the one failure a demo mode is worth least
against.

It exists because this has to be openable from a bare clone with no keys. The map already
draws without a MAPID key and questions are still answered without a model key, and a
login wall would have been the first thing in the product that stops working when a secret
is missing.

The interface says which mode it is in rather than leaving it to be found out: the
sign-in page explains it before the button, and the account page repeats it beside the
account itself. `AccountView.demo` carries it, so no surface has to infer it.

One door is closed the moment a database appears: `signInDemo` refuses outright when
`hasDatabase()` is true. It only exists because there is nothing behind it to protect, and
it must not survive the moment there is.

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
asking about, the field surveys against the two files they produced, and the
markdown reader together with the fence around a reply arriving in pieces.

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
server/         the data source, the model layer and the accounts. Never imported by
                the client. `answer.ts` is the one place a question is answered;
                `llm.ts` understands it; `stream.ts` reads a tool call while the model
                is still writing it; `mongo.ts` is the one place "is there a database"
                is answered and `accounts.ts` is the only thing that asks.
i18n/           every user-visible string, in both languages.
```

The rule is that the arrows only point downwards. `types.ts` in particular imports
nothing from `src` — it briefly imported two key unions back from `domain/`, and a
type-only cycle is still a cycle: the module everything depends on had come to depend on
two modules that depend on it. Key unions (`CategoryKey`, `MetricKey`, `UnitMetricKey`,
`PropertyType`, `ChatTopic`, `PlanKey`, `MeterKey`, `PackKey`) are declared there; the
tables that give them meaning live in the domain, as `Record<Key, …>` so a key without a
definition is a compile error.

The meters follow the same arrows and it is worth saying why, because a quota looks like
a server concern. `domain/plans` holds the arithmetic and knows nothing about storage,
which is what lets the browser spend against its own copy and the server spend against
the stored record using the very same functions. `domain/account` holds what counts as a
usable address and password, so the form and the endpoint enforce one rule rather than
two that drift. The map never learns whose account it is: `AppState` takes a `Wallet`,
which `AccountState` implements, so nothing in the map layer has ever seen an email
address, a plan name or a price.

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

**The tools are offered, not forced.** `tool_choice: 'required'` used to be set on the
request, and it cost more than it bought: free models vary in how well they honour it,
several answer a plain "halo" with a malformed call or with prose anyway, and prose was
read as a failure. So somebody saying hello fell through the whole chain to the rule
parser, which recognises greetings and nothing else.

A completion with no tool call is now read as what it plainly is, a casual reply, and it
goes through the SAME `cleanChatReply` fence as `ngobrol`'s own. That fence is what makes
this safe rather than merely lenient: a model that skips the tools and answers a data
question in fluent invented prose writes a digit while doing it, the reply is thrown away
rather than shown, and the turn moves on to a model that will call `jalankan_query`, or
to the rule parser, which computes the figures from data. Prose that fails the fence is
NOT a chat turn with a canned line, it is not an answer at all, because a model that
answered a data question in prose has not chatted, it has guessed.

The topic on such a turn is read off the QUESTION, never off the reply. It only decides
which canned line stands in when there is no sentence, and there is one here, so a wrong
guess costs nothing and a guess read off the model's own words would be the model
labelling itself.

The fence runs on every PREFIX of that reply, not only on the finished one. It has to,
because the reply is now streamed onto the reader's screen as the model writes it, and a
check that only ran at the end would put "warteg biasanya balik modal dalam 8 bulan" in
front of them for two seconds before taking it away. By then it has been read, which is
the whole harm. `withinFence` in `domain/chat` is that one rule, applied in both places.

## The answer streams, and what is in the stream

`POST /api/ai/query` replies either as one JSON object, the way it always has, or as a
stream of NDJSON events ending in an `answer` event carrying that very same object. Ask
for the stream with `stream: true` or an `application/x-ndjson` Accept header. Both run
`server/answer.ts`, so the two shapes cannot come to disagree about what the answer is.

**No figure is ever streamed.** Not one. The scoring engine runs on the grid in one go
and either has an answer or does not, so the whole answer arrives at once and the map
repaints from it in one move. A number arriving a digit at a time is a number the reader
watches being wrong, and the changes an answer makes to the map invalidate each other:
a highlight belongs to a category set, a unit list belongs to a radius.

What does stream is the wait itself, and it is worth streaming because it is long.
Understanding the question means a call out to a shared free model, up to ninety seconds
before the chain gives up and the rule parser takes over, and one motionless line for
that long is indistinguishable from a broken interface. So two things travel:

- **Which stage is running.** Reported from where the work actually is, never on a
  timer, and never as a percentage, because nothing here could honestly be one.
  `reading` is the question going out. `retrying` is one model dropping out and the
  next taking over, which is where the longest silences live. `choosing` is the model
  naming its operation and writing the arguments, which is the first proof it woke up.
  `computing` is the scoring engine on the grid.
- **The casual reply, as it is written.** The one sentence in the product the model
  writes for itself. It is a preview: the sentence in the finished answer is the
  authoritative one, and a `reset` event says the preview is void and must come down.

Nothing is ever shown from a tool call's ARGUMENTS as they arrive. Half an enum value is
not half an answer, and a category that appeared and then changed would be the interface
reporting a decision the model had not made yet. Only the fact that an operation was
named travels, which is all the reader needs to know the wait is moving.

A model that narrates a sentence before calling a tool is handled rather than trusted:
the preamble streams like any other reply, and the moment a tool other than `ngobrol` is
named it comes back down. Throat clearing must not be left sitting beside figures it
knows nothing about.

In the interface, `ui/Typed` reads a sentence out at the pace somebody would say it, and
every Tapak bubble goes through it whether the words were streamed or composed here from
figures that already existed. That is deliberate. A reader must not be able to tell from
the animation which sentences the model wrote, because the animation is not what tells
them: `parsedBy` and the provenance list are.

`domain/markdown` parses the bold, italic, code and lists a model emits whether or not
anybody asked it to, and it parses to a tree of plain objects rather than to HTML. There
is no `{@html}` on that path and therefore nothing to sanitise: a tag the model writes
arrives as text and leaves as text. Links are not supported on purpose, because a link
is the one markdown construct carrying a destination, and the destination would be a URL
a remote model chose.

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


### The model runs on that curve, and stops where the curve does

`CatchmentZoom` is the area card's diorama given the whole screen and a slider from
midnight to midnight. Two things move with that slider and they are not the same kind of
claim, so the view keeps them apart.

The LIGHT is arithmetic. `scene/daylight` puts the sun over the equator, where it rises
at about ten to six and sets at six all year, and nobody surveyed anything to know that.
The CROWD is this curve. Its shape is the doors counted open in that hour, and its
ceiling is unchanged from the card: the cell's own trade against the busiest cell on the
grid. At the peak hour the model therefore holds exactly the crowd the card holds, and
every other hour is that crowd scaled by the doors that were open.

This is the second time the app has had an hour on it. The first drove a crowd off a
24-hour profile generated by a random number generator seeded with the cell id, and the
comment at the top of `CatchmentDiorama` records why it came off. The difference between
the two is the whole reason this one is allowed to exist, so the rule is worth saying
plainly: **where the doors were not counted, the crowd does not move.** A cell under the
threshold, a cell where nobody published hours, a cell whose city is not in the catalogue
and a file that failed to load are four different silences. The view says which one it is
looking at, and in every one of them the model holds the crowd exactly where the card
has it. A street that empties at three in the morning because streets do is a sentence
about streets in general, not a reading of this one.

The figure printed under the slider is always the counted whole hour, never the slider's
exact position. `openAt` in `domain/activity` eases between the two hours either side so
that dragging across a boundary is not forty people appearing between two frames, and
that eased value reaches the model and nothing else.


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

## The map has a frame budget, and the panels on top of it were spending it

Everything on the app screen sits over one canvas that redraws on every frame of a
drag. That makes the map the only surface in this product with a frame budget, and it
is the one place where the cost of a piece of chrome is paid sixty times a second
rather than once.

Three rules came out of finding where it had gone.

**Nothing blurs while the map is moving.** `backdrop-filter` is not painted once: the
browser reads back what is behind the element, blurs it, and composites the result,
again on every frame the backdrop changed. Behind the panels the backdrop is a moving
map, so the whole of the floating chrome was being re-blurred on every frame of every
drag, and that was a third of the frame. `MapView` sets `data-map-moving` on the
document element between `movestart` and `moveend`, and `app.css` answers it by
swapping the material tokens flat, which is the same state
`prefers-reduced-transparency` already asks for. Add a floating surface over the map
and it inherits this for free, as long as it is built out of the `--mat-*` and
`--blur-*` tokens rather than a blur of its own.

**Read the DOM in one pass, write in another.** The map's own labels are laid out by
measuring boxes and hiding the ones that clash. Interleaved, every write makes the
browser lay the document out again to answer the next read, which is one forced layout
per label per frame. Measure everything, then decide. `positionTip` follows the same
rule from the other end: the map's box on the page is read once and remembered, not
read on every pointer move.

**Do not hand MapLibre data it already has.** `setData` builds a collection,
structure-clones it into the worker and re-tiles it there, and the grid is 562
hexagons. What is drawn is refreshed as one effect over every source, so anything that
re-ran it re-uploaded everything, and picking a cell used to re-upload the whole grid to
move one outline. Two things fix that and both are worth keeping: `pushSource` skips a
rebuild whose inputs are identical, and anything that is a HIGHLIGHT rather than a fact
about the place — hover, selection — belongs in feature state, which costs a paint.
