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
  state/                 app, tapak, lang, theme, account, clock
  server/source.ts       the one place the data source is decided
  server/gridmap.ts      where each cell is on the page, for every page that draws one
  server/answer.ts       one question answered, in one place, for both reply shapes
  server/mongo.ts        the one place "is there a database" is answered
  server/accounts.ts     accounts, sessions and the meters, over Mongo or over memory
  i18n/                  id.ts defines the shape, en.ts fills it
  scene/                 three.js models and daylight: the area, the landing block, the grid
  utils/                 format, geo, motion (springs)
```

Two rules hold this apart: the UI never reaches past `server/source.ts` for
data, and `domain/` never imports from `components/`.

## Data and environment

Copy `.env.example` to `.env` and fill it in.

| Variable | What it does |
| --- | --- |
| `OPENROUTER_API_KEY` | language understanding. Without it the app still works, questions fall back to the rule parser, and every figure is still computed by the scoring engine. |
| `OPENROUTER_MODEL` | optional model override: one slug pins one model, several separated by commas replace the whole fallback chain and are tried left to right. Empty means the free chain in `src/lib/server/llm.ts`. |
| `PUBLIC_MAPID_MAP_KEY` | the MAPID MAPS **Map Service key**. The style URL is built from it, and the light or dark style is picked to match the reader's theme. |
| `PUBLIC_MAPID_STYLE_URL` | a full style **URL**, for a style the app does not know about. Wins over the key, and pins one style regardless of theme. A bare key left in here is read as a key, because this is where the key used to go. |
| `MAPID_API_KEY` | read by the data scripts, not by the application |
| `MONGODB_URI` | where accounts, sessions and quotas are stored. **Empty means demo mode**, which is a supported way to run this rather than a broken one: one account, one button to sign in, records in memory. See "Two metered actions" below. |
| `MONGODB_DB` | optional database name inside that cluster. Empty means `spoton`. |

The model chooses an operation, fills in its arguments, and writes the sentence
the reader sees. It does NOT produce a number. Every figure on screen is computed
by `domain/scoring.ts`, on data, and a written sentence may only carry figures
that were, which `domain/grounded` checks rather than requests. That boundary is
the product's whole claim to being trustworthy, so do not move work across it.
See "The answer is computed, and then it is said" below before changing either
side of it.

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

## Getting in and getting out are reported, and the account is findable

Both doors used to go quiet when they were pressed. Signing in swapped the button's
label for "one moment" and then sat there for as long as the whole trip took. Signing
out did not even do that. Neither is one wait, and that is why one label could not
cover either of them.

**On the way in there are two waits, and only the first is short.** The address and
the password go out and come back in a moment. Then the browser navigates, the layout's
server load runs again for a request that finally carries a cookie, and the map fetches
the base grid before it can paint one cell. So the two are named separately, `checking`
and then the destination being opened, each read off where the work actually is. Neither
is a percentage and neither runs on a timer, which is the rule `POST /api/ai/query`
already follows for its own stages, and for the same reason: nothing here could honestly
be a percentage, since the grid either has arrived or has not.

**On the way out the same two things happen and neither used to show anything.** The
request clears the session, then the landing page loads over the top. One plain surface
carries the whole of it.

**Tapak is the waiting state, in all of them.** A spinner says the machine is busy and a
figure pacing says somebody is looking it up, which is the argument `TapakPanel` already
settled on the map. It is also the figure standing beside the account's own name on the
account page, so the thing met at the door is the thing that greets you inside. Do not
introduce a second waiting mark.

### The destination is drawn before it arrives

`ui/RouteSkeleton` draws the outline of the page being navigated TO, because the page
being navigated FROM is still the one on screen and a client-side navigation leaves it
there, motionless, for as long as the load takes. Two destinations get one: `/app`,
which fetches the grid, and `/account`, which reads that grid on the server and projects
all 562 catchments. Nothing else does, because nothing else is slow enough to need one.

It is held back briefly before it appears. A navigation that resolves in eighty
milliseconds is not a wait, and flashing an outline is worse than the instant somebody
would otherwise have had. That hold is the one timer in any of this and it decides only
whether to speak, never what to say.

**A placeholder is uniform, and that is the same rule the decorations are held to.**
`ui/Skeleton` is one flat fill at one weight with no part of it darker than another. A
placeholder carrying a partial fill would be a figure nobody has measured, drawn with
the very mark this product spends on a real balance two clicks away. One mark, one
meaning, and a track with a fill in it means what is left of an allowance. Sizes are
given by the caller, always, because only the caller knows what is coming: a placeholder
of the wrong size moves the page twice.

### The account has to be reachable from where the reader is

There was one route to it in the whole application and it was a pair of digits in the
map chrome. Both figures were right and neither said whose they were.

- **On the map**, `AccountChip` keeps the two figures and now says whose they are: Tapak
  at the head of it, and the hairline and fill the language toggle beside it wears, so it
  reads as a control rather than as part of the map's own readout. Tapak rather than an
  initial in a circle, for the reason the account page already gives.
- **On the landing page**, `landing/NavAccount`. That page is prerendered, so it is
  rendered by a build with no reader in front of it and `locals.account` is null for
  everybody. Asking in the browser is the only way it can know, and until the answer
  lands the bar holds a placeholder rather than guessing signed out and correcting itself
  in front of somebody who is signed in. Signed out is also what a dropped request draws,
  since `GET /api/account` answers "nobody" with a 200 precisely so that being signed out
  is a state to draw rather than an error to report.

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
asking about, the field surveys against the two files they produced, the
markdown reader together with the fence around a reply arriving in pieces, and
the greeting against the clock it is read from and both dictionaries that word
it.

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

## The walking range is measured from whatever the reader picked

`app.reach` is the one place that decides it: the cell centre in area mode, and the
place itself once one is open in place mode. Nobody rents a hexagon, and nobody walks
from the middle of one either — what a tenant walks starts at their own front door.

Everything that IS that range follows it, and they all have to move together. The ring
on the map, the transit fan and the competitor fan under it, and the four captured sets
those fans are drawn from: `selectedStops`, `selectedPois`, `selectedListings`,
`selectedOpen`. Move some and not others and you get a circle on screen with lines
reaching out past it.

**What does not move is anything the grid measured at build time.** The opportunity
score, how busy a cell is, the competitor count that score was taken over, the access
index, the median asking price and its rank were all counted from the cell centre by the
build scripts, at every radius the interface offers. There is no doorway reading of any
of them, and deriving one would be interpolating a figure nobody measured, which this
product does not do. So they stay the catchment's, and the copy beside them says whose
they are: `cardAreaNote` on the place card, `transitBandCell` beside the access index,
`medianIsCell` beside the price.

The rule that falls out of this, and the one to hold any change here to: **a figure
printed above a captured list is counted from the same point that list was.** Where the
grid has a reading for that point it is the grid's, because it is also what the score was
computed from and it is right before the file it names has even been fetched. Where the
grid has none, the figure is counted off the very list underneath it:
`countStops` does that for the transit nodes, `hoursReading` for the businesses the hour
curve is drawn from, and `RivalsPanel` was already counting the dots on the map rather
than the scored row's figure.

Two absences the grid used to cover for, and which have to be said out loud once the
range is a place's. Nothing has been counted until `stops.json` and `hours.json` land, so
an empty capture means "not yet" rather than "none", and a failed fetch means "could not
be counted" rather than "nothing here". `ScoreBreakdown` is the one surface deliberately
left on the cell centre, through `cellStops`: it takes the access index apart, and that
index was built from counts taken from the cell centre.

## Small talk is allowed, and fenced in code

Tapak can say hello, say what SpotOn is, and talk generally about running a small
business. It could not before, and a greeting met with "that is outside what I can
answer" reads as broken rather than rigorous.

This is the one place the model writes a sentence with NOTHING COMPUTED BEHIND IT, which
makes it the one place where the only possible source for a figure is invention. The
answer to a data question is written by the model too, and is fenced differently for
exactly that reason: there, figures exist and the rule is that the sentence may only carry
those. See "The answer is computed, and then it is said". Here nothing was computed, so
the rule is that it may carry none. "Warteg biasanya balik modal dalam 8 bulan"
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

## The answer is computed, and then it is said

For a long time an answer could be said exactly one way. The model picked an operation,
the engine ran it, and a template in `i18n` read the result out. So every ranking opened
with the same clause, every explanation was the same paragraph with different numbers, and
two genuinely different questions about one catchment came back WORD FOR WORD IDENTICAL:

> **why does it fit?**
> Tosari scores 68 out of 100 for laundries, and here is what that is made of. […]
>
> **do you think tosari has good rent?**
> Tosari scores 68 out of 100 for laundries, and here is what that is made of. […]

The second question is about the price of space and is answerable: the figures were on the
row the whole time. What answered it was a template keyed on the INTENT, and the intent was
the same both times. No amount of conversation memory fixes that, because the memory was
working. It was a state machine with a chat window in front of it.

So the model writes the answer. `server/reply.ts` runs a second pass once the engine has
finished: it is handed the question, the thread, and every figure this turn produced, and
it writes the reply in the reader's language. The templates in `i18n` are still there and
are still exactly right, as the fallback.

**The engine did not move.** Every figure is still computed by `domain/scoring` on the
data, before this pass exists and without reference to it. What changed is who writes the
sentence around them, and nothing else.

### The fence, which is what makes this a widening rather than a hole

`domain/chat`'s rule is no digits, and that is right where it applies: a casual turn
computes nothing, so any figure in it is invented by definition. It is the wrong rule here,
where the engine has just produced a page of figures and the whole job is to say them.

What replaces it is GROUNDING, in `domain/grounded`: a reply may carry a figure only if
that figure is one it was handed. Not plausible, not the right order of magnitude —
present, in the facts this turn computed. So the product's promise is unchanged and is
worth stating in the same words as before: **no figure a reader sees came from the model.**

Five things hold it up:

- **The sheet and the whitelist are ONE STRING.** `factSheet` builds the text the model
  reads from, and `cleanGroundedReply` builds its allowed set from that very text. Two
  texts is how the two come to disagree, and a disagreement in that direction rejects true
  figures rather than admitting false ones, which is the failure that hides.
- **Both renderings of a figure are in the sheet.** The interface prints Rp 59,8 jt and the
  engine's own prose writes Rp 59.750.000, and a model shown one will sometimes write the
  other. Both are grounded because both are written down, and the short one is rounded
  through `utils/format`'s `moneyScale`, the same function both locale files round through.
  Divide by a million here instead and every catchment above a billion has its correct
  price rejected, with no symptom but Tapak sounding plainer there.
- **A quantity spelled out is still a quantity.** "Balik modal dalam delapan bulan" carries
  no digit and is the same fabrication as the one that does. Counts in words are refused
  outright, and a scale word ("juta", "million") only passes with a grounded figure
  immediately in front of it, because "Rp 59,8 juta" is how a true figure is written and
  "beberapa juta" is a claim about money nobody measured.
- **A name is checked too.** A right figure quoted against the wrong catchment is wrong in
  the one way a reader cannot catch, because the number checks out. The grid's names are a
  closed set, so a reply naming a catchment this answer did not name is refused. Lone short
  names are exempt and that hole is deliberate: Damai, Duri, Karet, Depok and Tebet are
  ordinary words, and checking them would throw away true replies for saying "kawasannya
  damai" while the list of places sits on screen directly under the sentence.
- **It is never streamed.** Every other model-written sentence is, because a casual reply
  carries no figures and watching one appear is watching a wait move. This one is made of
  figures, and the rule about those has not moved: no figure is ever streamed. A number
  arriving a digit at a time is a number being read before it has been checked, and the
  check is the entire reason this is allowed to exist.

A rejected reply is thrown away whole rather than repaired, and the composed sentence
stands in. So the worst a misbehaving model can do is cost the reader the plainer answer.
The same is true of no key, a timeout, or a model that is busy: `reply` is absent and
everything downstream behaves as it did before this existed.

`selftest-grounded.mjs` holds it, and its last check is the load-bearing one. The composed
sentences are built entirely from computed figures, so they are grounded by construction
and MUST clear the fence. If they cannot, the fence is rejecting true figures, and the
symptom of that is not an error: it is Tapak silently falling back to the plain answer on
every turn forever, while every test about invented figures still passes. That check has
already earned its place once, on prices.

### A shape and a measure, again

`EXPLAIN` arrived answering one question: why is this catchment on the list. It always
explained the opportunity score, whatever had been asked, and that is the mistake
"Questions are a shape and a measure, chosen separately" is about, made again in a newer
shape. Two questions naming the same place produced the same paragraph:

> **what is the rent at Pusdiklat BPS**
> Pusdiklat BPS scores 59 out of 100 for bakeries, and here is what that is made of. […]

The price was in that paragraph, fourth. Three separate things had to be true before it
could lead:

- **`ukuran` survives an EXPLAIN.** `llm.ts` read it only for a RANK and overwrote it with
  the opportunity score otherwise, so a model that read the question perfectly had its
  answer thrown away one line later.
- **Naming a place is enough.** A follow-up can POINT ("kenapa yang itu"), which needs a
  why-word because there is nothing else in the sentence to go on, or it can NAME, which
  needs none. Without the second, a question with no "kenapa" in it fell through to a
  ranking. The two shapes that name a place and are not about it are a ranking ask and a
  comparison, and those are what `RANKING_ASK` and `COMPARE_ASK` exist to hold back.
- **The English half of the money words existed.** `harga_tempat` matched `harga|sewa|
  biaya|mahal|murah` and not one English word, while the unit registry beside it had
  carried `cheap|price` all along. Every English question about money fell past both to
  the opportunity score.

Two rules keep the widened name matching from firing on ordinary language, and both are
worth knowing before touching it. A name is only looked for when it is DISTINCTIVE, more
than one word or at least six letters, because Damai, Duri, Karet, Depok and Tebet are
catchments and are also words. And a match has to cover most of the name rather than a
corner of it: "harga karet berapa sekarang" contains the first word of "Karet Sudirman 3"
and none of the rest, and read as a hit it answers a question about the price of rubber
with a catchment in Setiabudi.

One collision had to be split by hand and will come back if the patterns are merged. A
bare "for rent" means ON THE RENT MEASURE and asks what space costs. "Space for rent" asks
which places are being offered, which is the field survey and a different measure
entirely. `sewa_ditawarkan` therefore matches the phrases that name the offer and not the
bare word.

### What this does not license

The writing pass is not a second opinion and must not become one. It receives figures and
a question and writes one answer. It does not choose the operation, does not decide which
catchments are named, does not rank anything, and gets no say in what the map does. Those
belong to the understanding layer and the engine, and the day something here starts
deciding one of them, the fence stops meaning anything: it checks what a sentence SAYS, not
what an answer IS.

## It is a thread, and the thread is part of the question

Every question used to go out on its own. So somebody who was handed five catchments and
typed "kenapa Setiabudi Astra" got the same five names back, under the same sentence,
with nothing on screen to say the question had not been read. That is not a small
shortfall in a guide who opens by asking what you want to open: a follow-up is BY
DEFINITION a sentence that does not carry its own subject, and every one of them was
parsed as though it did.

So the turns before this one travel with it, in `AskInput.history`, and the model reads
them as ordinary messages. That is the whole mechanism, and it is deliberately the only
one: there is no table here of the shapes a follow-up may take. "Kenapa yang itu",
"bandingkan dua teratas", "kalau apotek", "coba yang 500 m" are all the same to this
code, which is that they are read in context and the understanding layer decides, per
turn, whether answering needs data at all. A phrasebook would be the wrong shape twice
over: it would be wrong the first time somebody said something not in it, and it would
have to be kept in step with a model that does not need it.

Three rules hold it up, and each of them is one of this file's existing rules applied to
a conversation:

- **The reader's words travel whole. Tapak's do not.** An answer is mostly figures, and
  a figure the model has seen written down is a figure it can write down again in a
  casual reply, where nothing recomputes it. So an answer goes back as the NAMES it put
  on screen and nothing else, and any sentence riding along has to clear the very fence
  a casual reply clears, which is `domain/chat`'s and which no digit clears. What a
  follow-up points at is a name. A name is all this has to carry.
- **The thread is read as input, not as our own output coming back.** Anything can post
  to `/api/ai/query`. The turns are capped in number and in length, the roles are read
  as a closed pair, and anything that is not a string is dropped. Nothing is trusted for
  looking familiar.
- **The engine is told less than the model is.** `resolveQuestion` hands the model the
  whole thread and hands the scoring engine one list of names. The engine knows all 562
  catchments and cannot know which of them were on screen a moment ago, and that is the
  only thing about the conversation it needs.

### EXPLAIN, the one shape that was missing

`domain/metrics` already separates the SHAPE of a question from the MEASURE it is about,
and every shape there answered "which places". None of them answered "why that one",
which is the question a reader asks the moment they have been handed a list. So `EXPLAIN`
takes one named catchment and hands back the parts its score is made of.

Nothing new is computed for it. The row comes off the same `scoreAll` on the same grid as
every ranking, and what the intent adds is only that its parts travel SEPARATELY, in
`AiAnswer.explain`, so the reply can be rebuilt in the reader's language. That is the
same split `measure` already makes on a recommendation row, and it is why the reply is
not the engine's `why` line: that line is API output and is pinned to Indonesian.

Four things about it are worth knowing before changing it:

- **`target` is read before the sentence.** "Kenapa yang itu" carries no name at all.
  The understanding layer resolves it against the thread and writes the name into
  `target`, and only a query that carries none falls back to reading names out of the
  question. `COMPARE` now reads it the same way, which is what makes "bandingkan dua
  teratas" work: it used to read the sentence alone, so it could only ever be used by
  somebody who typed both names into the very message asking for the comparison.
- **An explanation needs a business type**, for the same reason a ranking by opportunity
  score does. There is no score to take apart until somebody has said what for, and
  `runQuery` asks rather than picking one.
- **Nothing in `field` is in `Explanation`.** The surveys are evidence beside a score and
  never a term in it, so a shape whose whole job is to say what a score is MADE OF is the
  last place they belong. Listed among the parts, "nobody has been down this street"
  reads as one of the reasons for the number.
- **No filters ride on it.** One named place is not a pool to narrow, and a chip row
  saying "cheap space" under a reply about one catchment would claim a narrowing that
  never happened.

The rule parser gets the narrow half of this, exactly as it gets the narrow half of chat.
It recognises a why-word plus either a name from the conversation or a pointer and
nothing else, which is the same test `ruleChatTopic` applies to a greeting and for the
same reason: "kenapa lokasi penting" is a question carrying its own subject, and
answering it with one catchment's arithmetic would be answering something nobody asked.
The long tail is not pinned in `selftest-nlq.mjs` and must not be grown there. With no
key at all the plain forms work, and everything else is the model's job.

## The greeting knows the hour and nothing else

Two surfaces say hello: the question box the app opens on, and Tapak's first bubble.
Both greet by the clock on the reader's own DEVICE, through `state/clock`, which reads
it once when the page loads and then leaves it alone. `domain/daypart` holds the bands
and the pick, as pure functions over a clock reading, so nothing in the domain ever
calls `new Date()`.

The day is cut into the five parts Indonesian greetings already use: `dini_hari`,
`pagi`, `siang`, `sore`, `malam`. They are the domain's own vocabulary, the way
`CategoryKey` is, because there is no English set of five that lines up with them and
English has no single word for sore at all. One boundary is bent: `pagi` runs to noon
rather than to eleven, since "selamat pagi" at half past eleven is ordinary and "good
afternoon" before twelve is wrong.

Four rules hold it up, and `selftest-daypart.mjs` asserts all of them.

- **A greeting knows the hour and nothing else.** Not the weather, not whether the
  street outside is busy, not whether the reader has had a long day. This is the same
  rule that keeps invented figures off the screen, with the number taken out: "the
  shops are just opening" is exactly the claim nobody measured. The test refuses a
  digit in any wording for the same reason `domain/chat` refuses one in a model's
  reply.
- **The wording rotates with the day, it is not drawn at random.** Somebody who reloads
  to check something reads the same sentence rather than watching the page change its
  mind, and a rotation is something the server can work out and a coin toss is not.
  Three wordings per part, held as a tuple in `types.ts` so the two dictionaries cannot
  come to hold different numbers of them, and the test checks that every one of them is
  reachable.
- **The server reads Jakarta, and the device corrects it.** The opening card is
  server-rendered and the server has no device to ask. Jakarta is the same fixed zone
  the week already turns on, so a reader there sees one greeting either side of
  hydration and a reader elsewhere sees it corrected once on the way in. That is the
  trade `state/lang` already makes by rendering Indonesian first. The test sweeps a
  year of readings to check the two agree in Jakarta, and that they disagree in London
  in both halves of the year, since an offset remembered rather than a zone asked for
  would drift in March.
- **Both surfaces say the same thing.** The salutation is one table, `copy().greeting`.
  The card prints it alone and `tapak.greet` opens with it, so the two cannot come to
  disagree about what time it is. The part and the wording travel to the dictionary as
  POSITIONS rather than as a finished phrase, which is what lets switching language
  change the words without changing which greeting is being said.

The heading under it does not move. "Mau buka usaha apa?" is what the reader is here to
answer and it is the same question at every hour, so the greeting sits above it rather
than rewriting it.

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
- **The casual reply, as it is written.** The one sentence the model writes with nothing
  computed behind it. It is a preview: the sentence in the finished answer is the
  authoritative one, and a `reset` event says the preview is void and must come down.
  The written ANSWER does not travel this way and must not, because it is made of
  figures and the rule about those is the one above: no figure is ever streamed.

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


### The model is the map, cut to the walking range

The area card's model, and the full-screen one `CatchmentZoom` opens, used to be a
schematic block: one composed street with a cafe, a stop and three lots, standing for
every cell, with only the counts varying. They are now a recreation of the place.
`domain/basemap` reads the basemap's own vector tiles, the building footprints, streets,
water and parks the map draws, and cuts them to a disc of the walking radius around the
point the range is measured from. `scene/area` stands the result up, and the map's own
marks stand on it where the map draws them: stops in their mode's colour, competitors as
the red square, units on the market as the amber diamond, field records as the hollow
ring, the point itself as a beacon in the accent.

**Whichever basemap the map is on is the one that is read.** `readBasemapTiles` in
`map/basemap` takes the tile source off the style MapLibre actually loaded, so a MAPID
key changes the model along with the map and the open basemap models exactly what it
draws. The tiles are fetched by `AppState.loadArea` the way the stops and the listings
are fetched, decoded once, and kept per TILE rather than per area, because a tile is a
little wider than a walking range and neighbouring cells share most of theirs. `area` is
`$state.raw`, and it has to be: it holds tens of thousands of coordinates the scene walks
in one pass, and a deep proxy over them made that pass many times slower for a
reactivity nobody reads.

Four rules hold it up, and they are the product's own rules applied to geometry:

- **Nothing is invented.** A building stands at the height the tile carries, which is
  OpenStreetMap's figure where one was tagged and the schema's own default where not:
  the same figure the map's raised view would give it. A street the tile does not draw
  is not drawn. There is no typical block any more, anywhere in the product.
- **The hour lights doors, not people.** The schematic sculpted a crowd and scaled it by
  the doors counted open. At the scale of a real 800 m disc a person is one pixel, and a
  crowd drawn ten times life size would be a claim about where people stand that nobody
  counted. So the doors themselves are drawn: one mark per business with readable hours,
  at the position OpenStreetMap holds for it, lit when its timetable says it is open in
  the hour on the slider and dark when it does not. It is the very count the activity
  chart draws, shown where it was counted. Where the doors were not counted, none is
  drawn and the view says which silence it is, exactly as before.
- **Every shape is cut to the disc, and every tile to its own square first.** A tile
  carries a margin of its neighbours so a line can be drawn across the seam, and read
  whole that margin put a second copy of every building along the seam on top of the
  first. The cut to the disc follows the ARC of the circle where a shape leaves it and
  comes back. A chord was the first attempt, and on a river covering half the disc it
  cut the river in half. Which way round the arc goes is read from the path itself, the
  angle the shape swept around the centre while it was outside, and NOT from the ring's
  own orientation: a house bulging over the edge can sweep either way whatever way its
  ring turns, and taking the direction from the ring sent one the long way round, a
  roof the size of the disc at five metres with the whole street network hidden under
  it. `utils/geo` says so above the function.
- **The mark on the model says where it came from.** Four states, one mark, in both
  languages: built from the basemap, still reading it, the read failed, or a basemap
  that carries no geometry at all. That last one is the raster fallback and nothing
  else. A blank disc never has to be interpreted.

The card's model runs on JAKARTA'S clock, not the reader's. It ran on the reader's own
hour when all the hour lit was the sky, which was a fact about them. Now the lit doors on
it are a claim about the place at this minute, the same claim the "open now" row under
it makes, and a model lit by a reader's midnight in London would show a Jakarta lunch
hour with the street dark around it.

The marks follow the map's layer switches, for the reason the map's own marks do: a
competitor the reader has switched off the map must not go on standing in the model of
it. What does not follow anything is the geometry itself. The map is free, and a model of
the map is the map looked at another way, so reading it is not metered.

### The map itself can be looked at the same way

`MapControls` carries a second switch beside flat or 3D: DRAWN, the basemap as its
publisher draws it, or MODELLED, the same tiles drawn by MapLibre in the area model's
palette. White masses raised to the height the tile carries, streets at their real widths
from the same table the scene lays its ribbons by, water and green, and none of the
publisher's cartography or lettering. `map/modelled` builds those layers off the very
sources `readBasemapTiles` found, so the map's model and the area's model come from one
reading of one style, and a basemap the area model can read is exactly the basemap the
map can draw as one. The switch is absent when there is nothing to model from, which is
the raster fallback and nothing else.

It is a view, like the raised one, and is held to the same rule: it changes how the map
is looked at and nothing about what is on it. The publisher's layers are put away with
the visibility each was published with and brought back exactly, never removed, and the
app's own layers, the catchments, the corridors and the marks, sit above both renditions
untouched. In the dark theme the palette is taken down rather than kept white, because a
white city under a dark interface would be the brightest thing on the screen, and unlike
the model on the card there is no hour lighting it.

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
