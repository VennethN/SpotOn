const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const F = JSON.parse(fs.readFileSync('../assets/figures.json', 'utf8'));
const CROPS = path.resolve('../crops');
const ASSETS = path.resolve('../assets');
const ICONS = path.resolve('icons');
const img = (n) => path.join(CROPS, n);
const icon = (n, c = 'blue') => path.join(ICONS, `${n}-${c}.png`);
const num = (v) => v.toLocaleString('en-US');

const INK = '0B0C0E', INK2 = '3A3D45', MUTED = '6B7280', LINE = 'DDE1E7', BG = 'ECEEF1', WHITE = 'FFFFFF';
const BLUE = '0071E3', BLUE_SOFT = 'E1ECFA', BLUE_DEEP = '143F7C', PALE = 'C9CDD4', DARK = '0B0C0E';
const FONT = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.author = 'Team Triple T';
pres.title = 'SpotOn · MAPID WebGIS Competition 2026 · Final pitch';

const shadow = () => ({ type: 'outer', blur: 8, offset: 2, angle: 90, color: '0F1624', opacity: 0.10 });

function text(slide, t, o) {
  slide.addText(t, { fontFace: FONT, fontSize: 18, color: INK2, isTextBox: true, margin: 0, valign: 'top', align: 'left', ...o });
}
function card(slide, x, y, w, h, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: o.fill || WHITE }, line: { color: o.line || LINE, width: 0.75 }, rectRadius: 0.12, shadow: o.flat ? undefined : shadow() });
}
function hexIcon(slide, x, y, size, name, o = {}) {
  slide.addShape(pres.shapes.HEXAGON, { x, y, w: size, h: size, fill: { color: o.fill || BLUE_SOFT }, line: { color: o.fill || BLUE_SOFT, width: 0 } });
  slide.addImage({ path: icon(name, o.colour || 'blue'), x: x + size * 0.26, y: y + size * 0.26, w: size * 0.48, h: size * 0.48 });
}
function hexNumber(slide, x, y, size, n, o = {}) {
  slide.addShape(pres.shapes.HEXAGON, { x, y, w: size, h: size, fill: { color: o.fill || BLUE }, line: { color: o.fill || BLUE, width: 0 } });
  text(slide, String(n), { x, y, w: size, h: size, fontSize: o.fontSize || 20, bold: true, color: o.colour || WHITE, align: 'center', valign: 'middle' });
}
function kicker(slide, t) {
  text(slide, t, { x: 0.6, y: 0.42, w: 8, h: 0.35, fontSize: 18, bold: true, color: BLUE, charSpacing: 2 });
}
function title(slide, t, w = 9.5) {
  text(slide, t, { x: 0.6, y: 0.78, w, h: 1.2, fontSize: 32, bold: true, color: INK, valign: 'top' });
}
function bullets(slide, items, o) {
  slide.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1, paraSpaceAfter: 6 } })), { fontFace: FONT, fontSize: 18, color: INK2, isTextBox: true, margin: 0, valign: 'top', ...o });
}
function brand(slide, dark) {
  slide.addImage({ path: path.join(ASSETS, dark ? 'mark-white.png' : 'mark-ink.png'), x: 11.6, y: 0.4, w: 0.42, h: 0.42 });
  text(slide, 'SpotOn', { x: 12.05, y: 0.4, w: 1.2, h: 0.42, fontSize: 18, bold: true, color: dark ? WHITE : INK, valign: 'middle' });
}

/* ── 1 · Title ─────────────────────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addImage({ path: img('hero.png'), x: 5.55, y: 0, w: 7.78, h: 7.5, sizing: { type: 'cover', w: 7.78, h: 7.5 } });
  s.addImage({ path: path.join(ASSETS, 'mark-white.png'), x: 0.7, y: 0.65, w: 0.7, h: 0.7 });
  text(s, 'SpotOn', { x: 1.5, y: 0.65, w: 3, h: 0.7, fontSize: 30, bold: true, color: WHITE, valign: 'middle' });
  text(s, "Don't guess\nwhere to open.\nAsk the map.", { x: 0.7, y: 1.8, w: 5.0, h: 2.7, fontSize: 40, bold: true, color: WHITE, valign: 'top' });
  text(s, 'An AI-assisted WebGIS for retail and F&B site selection around the Jakarta transit network.', { x: 0.7, y: 4.55, w: 4.5, h: 1.0, fontSize: 20, color: PALE });
  text(s, 'Team Triple T, Universitas Bina Nusantara', { x: 0.7, y: 5.55, w: 4.8, h: 0.6, fontSize: 18, bold: true, color: WHITE });
  text(s, 'Valent Nathanael, Farhan Aulianda, Anthony Gilles Rudolfo', { x: 0.7, y: 6.15, w: 4.8, h: 0.6, fontSize: 18, color: PALE });
  text(s, 'MAPID WebGIS Competition 2026, Final', { x: 0.7, y: 6.75, w: 4.8, h: 0.6, fontSize: 18, color: '8FB8F0' });
  s.addNotes('Opening, 15 seconds. "Good morning. We are Triple T from BINUS, and this is SpotOn. Around Jakarta\'s stations, people still choose where to open a shop by instinct. SpotOn lets them ask the map instead." If you want the BINUS logo on this slide, place it at the top right in Canva.');
}

/* ── 2 · Problem & Background ─────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '01 · PROBLEM & BACKGROUND');
  title(s, 'Pick the wrong spot and it is your capital that burns.');
  text(s, 'Station blocks are the busiest trading ground in Jakarta. Yet most owners still pick a location on instinct or by copying a competitor, and the wrong choice burns their capital.', { x: 0.6, y: 2.05, w: 7.9, h: 1.25, fontSize: 18 });
  const rows = [
    ['FiEyeOff', 'Nobody counted how busy it is', 'Everyone knows station blocks are busy. Nobody knows which blocks.'],
    ['FiUsers', 'The competition is invisible', 'A street already full of coffee shops is a way to lose money.'],
    ['FiHome', 'The space is never counted', 'A good area with nothing to rent is not an opportunity.']
  ];
  rows.forEach(([ic, h, d], i) => {
    const y = 3.3 + i * 1.25;
    card(s, 0.6, y, 7.9, 1.13);
    hexIcon(s, 0.8, y + 0.24, 0.65, ic);
    text(s, h, { x: 1.65, y: y + 0.12, w: 6.6, h: 0.4, fontSize: 20, bold: true, color: INK });
    text(s, d, { x: 1.65, y: y + 0.5, w: 6.6, h: 0.62, fontSize: 18, color: INK2 });
  });
  card(s, 8.8, 2.05, 3.93, 4.98);
  hexIcon(s, 9.0, 2.25, 0.6, 'FiTarget');
  text(s, 'Target users', { x: 9.75, y: 2.3, w: 2.9, h: 0.5, fontSize: 20, bold: true, color: INK, valign: 'middle' });
  bullets(s, ['Retail and F&B investors', 'Small businesses', 'First-time owners', 'Franchise teams', 'Property agents'], { x: 9.0, y: 3.0, w: 3.55, h: 2.4 });
  s.addImage({ path: img('chart-spread-r.png'), x: 9.0, y: 5.4, w: 3.53, h: 1.48 });
  s.addNotes('40 seconds. Background: transit blocks are the busiest trading ground in Jakarta, and the location decision is still a guess. Three problems: busyness is not counted, competition is not mapped, available space is never checked. Target users: investors and franchise teams, but above all small businesses and first-time owners with no GIS skills. The chart is real: most cells are quiet and a few are dense, so where you open matters.');
}

/* ── 3 · Solution & Concept ───────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '02 · SOLUTION & CONCEPT');
  title(s, 'Ask the map where to open, and why.');
  text(s, 'Solution', { x: 0.6, y: 2.0, w: 6.3, h: 0.35, fontSize: 18, bold: true, color: BLUE, charSpacing: 1 });
  text(s, `SpotOn scores every walkable catchment around Jakarta transit for ${F.categories} business types, ranks them, and lets you ask Tapak, the AI guide, in plain Indonesian or English. Tapak answers with the reasons attached.`, { x: 0.6, y: 2.38, w: 6.3, h: 1.55, fontSize: 18 });
  text(s, 'Objective', { x: 0.6, y: 4.05, w: 6.3, h: 0.35, fontSize: 18, bold: true, color: BLUE, charSpacing: 1 });
  bullets(s, ['Bring demand, competition and available space into one score per cell', 'Explain every score step by step, with the N behind it', 'Say "not surveyed" instead of guessing where data is missing'], { x: 0.6, y: 4.43, w: 6.3, h: 2.4 });
  s.addImage({ path: img('grid-model-r.png'), x: 7.3, y: 1.95, w: 5.43, h: 2.35 });
  text(s, 'Value proposition', { x: 7.3, y: 4.5, w: 5.4, h: 0.35, fontSize: 18, bold: true, color: BLUE, charSpacing: 1 });
  const vals = [['FiLayers', 'Three signals, one score per cell'], ['FiMessageCircle', 'Plain answers, computed figures'], ['FiShield', 'Not surveyed is said, never guessed']];
  vals.forEach(([ic, t], i) => {
    const y = 4.95 + i * 0.68;
    hexIcon(s, 7.3, y, 0.52, ic);
    text(s, t, { x: 7.95, y: y - 0.04, w: 4.8, h: 0.6, fontSize: 18, color: INK, valign: 'middle' });
  });
  s.addNotes('40 seconds. The solution: a decision-support WebGIS. Every catchment around a station gets an Opportunity Score per business type, and Tapak, the guide, answers questions in plain language with the reasons attached. Objective: join the three signals, explain every score, and never dress up missing data. The model on the right is the real grid: height and colour are real scores.');
}

/* ── 4 · Data & Methodology ───────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '03 · DATA & METHODOLOGY');
  title(s, 'From field data to one score per cell.');
  const sources = [
    ['FiDatabase', 'MAPID Premium', `${num(F.mapidPoints)} competitor points, ${F.categories} business types, five cities`],
    ['FiClipboard', 'MAPID Apps', `${num(F.mission.records)} field records: Struk Go, Menu Go, Properti Go, notes`],
    ['FiMap', 'OpenStreetMap', `${num(F.stops)} transit stops, ${num(F.osmPois)} POIs, opening hours`],
    ['FiTag', 'MAPID Property', `${num(F.listings)} commercial listings with asking prices`]
  ];
  sources.forEach(([ic, h, d], i) => {
    const x = 0.6 + i * 3.08, y = 2.0, w = 2.93, hh = 2.15;
    card(s, x, y, w, hh);
    hexIcon(s, x + 0.18, y + 0.18, 0.55, ic);
    text(s, h, { x: x + 0.85, y: y + 0.12, w: w - 1.0, h: 0.7, fontSize: 18, bold: true, color: INK, valign: 'middle' });
    text(s, d, { x: x + 0.18, y: y + 0.9, w: w - 0.36, h: 1.2, fontSize: 18, color: INK2 });
  });
  const steps = [
    ['H3 hexagonal grid', `Resolution ${F.resolution}. ${num(F.hexes)} cells with a transit stop within an ${F.walkRadius} m walk.`],
    ['Spatial join', 'Rivals, other trade, stops, listings and field records, per cell.'],
    ['Opportunity Score', '(busy minus rivals) × space gate × transit access × cost of space.'],
    ['Tapak, the AI layer', 'The model picks the operation by function calling. The engine computes.']
  ];
  steps.forEach(([h, d], i) => {
    const x = 0.6 + i * 3.08, y = 4.35, w = 2.93, hh = 2.35;
    card(s, x, y, w, hh, { fill: WHITE });
    hexNumber(s, x + 0.18, y + 0.18, 0.55, i + 1);
    text(s, h, { x: x + 0.85, y: y + 0.12, w: w - 1.0, h: 0.7, fontSize: 18, bold: true, color: INK, valign: 'middle' });
    text(s, d, { x: x + 0.18, y: y + 0.88, w: w - 0.36, h: 1.47, fontSize: 18, color: INK2 });
    if (i < 3) s.addImage({ path: icon('FiArrowRight', 'deep'), x: x + w - 0.02, y: y + 1.05, w: 0.2, h: 0.2 });
  });
  text(s, 'Field records never enter the score. They stay on the area card as evidence.', { x: 0.6, y: 6.85, w: 12.1, h: 0.4, fontSize: 18, color: MUTED });
  s.addNotes('45 seconds. Four sources: the MAPID premium catalogue for competitors, the MAPID Apps missions for field evidence, OpenStreetMap for transit and opening hours, and the MAPID property catalogue for prices. Method: an H3 grid at resolution 8, 800 m walking range, a spatial join per cell, and a transparent score: busy minus rivals, gated by available space, multiplied by transit access and the cost of space. AI sits on top: the model only understands the question through function calling. Every number is computed by the engine and a grounding check throws away any reply that quotes a figure the engine did not produce.');
}

/* ── 5 · WebGIS Features ──────────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '04 · WEBGIS FEATURES');
  title(s, 'One map, and a guide who explains it.');
  const feats = [
    ['FiMap', 'Map on MAPID MAPS', `${num(F.hexes)} hexagons, flat or 3D. Zoom, click, filter, layers, table.`],
    ['FiMessageCircle', 'Tapak, the AI guide', 'Ask in Indonesian or English. The map recolours with the answer.'],
    ['FiBarChart2', 'Area card', 'Score breakdown, rivals, transit, hours, space cost, field notes.'],
    ['FiHome', 'Place pivot', 'Every premise on the market, ranked with the score of its area.']
  ];
  feats.forEach(([ic, h, d], i) => {
    const y = 2.05 + i * 1.25;
    hexIcon(s, 0.6, y + 0.05, 0.6, ic);
    text(s, h, { x: 1.4, y, w: 4.5, h: 0.4, fontSize: 20, bold: true, color: INK });
    text(s, d, { x: 1.4, y: y + 0.42, w: 4.5, h: 0.82, fontSize: 18, color: INK2 });
  });
  s.addImage({ path: img('app-rank-r.png'), x: 6.2, y: 2.05, w: 6.53, h: 3.67 });
  text(s, 'A coffee shop question answered on the live map: ranked cells, reasons, and follow-ups.', { x: 6.2, y: 5.85, w: 6.53, h: 0.8, fontSize: 18, color: MUTED });
  s.addNotes('40 seconds. This is the live interface. The map is the primary element: 562 hexagons on the MAPID MAPS basemap, with zoom, click, filters, layer control and an attribute table. Tapak sits on the right: ask in plain language and the map recolours. Click a cell and the area card takes the score apart. Switch to "By place" and the premises actually on the market are ranked. Demo at the booth.');
}

/* ── 6 · Results & Insights ───────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '05 · RESULTS & INSIGHTS');
  title(s, 'What the map says about coffee shops.');
  s.addImage({ path: img('map-3d-r.png'), x: 0.6, y: 2.05, w: 5.6, h: 4.39 });
  text(s, `Coffee shop opportunity score, all ${num(F.hexes)} cells, 3D view.`, { x: 0.6, y: 6.55, w: 5.6, h: 0.6, fontSize: 18, color: MUTED });
  const t = F.kopiTypology, top = F.kopiTop5[0];
  const insights = [
    [`${t.underserved} · ${t.competitive} · ${t.saturated}`, 'cells underserved, competitive and saturated. Most of the city is contested. The gaps are few and specific.'],
    [`${top.name} · ${top.score}`, `${num(top.density)} businesses in walking range, only ${top.osm} coffee shops, ${top.units} units on the market, 4 transit nodes.`],
    [`${num(F.surveyedCells)} + ${num(F.unsurveyedCells)}`, 'cells scored, and cells left unscored because no source has surveyed their city. Never interpolated.']
  ];
  insights.forEach(([big, d], i) => {
    const y = 2.05 + i * 1.65, x = 6.5, w = 6.23, h = 1.55;
    card(s, x, y, w, h);
    text(s, big, { x: x + 0.25, y: y + 0.1, w: w - 0.5, h: 0.5, fontSize: 26, bold: true, color: BLUE, valign: 'middle' });
    text(s, d, { x: x + 0.25, y: y + 0.6, w: w - 0.5, h: 0.92, fontSize: 18, color: INK2 });
  });
  s.addNotes('45 seconds. Results for one business type, coffee shops: 37 cells underserved, 508 competitive, 17 saturated. Rawa Selatan tops the ranking at 65: 273 businesses around it, only 5 coffee shops, 12 units on the market and 4 transit nodes. And the honesty rule: 462 cells are scored, 100 sit in a city no source has surveyed yet, and they are shown as such rather than filled in. Every one of these figures is computed by the engine from the data, and Tapak can only quote figures the engine produced.');
}

/* ── 7 · Impact & Closing ─────────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  brand(s, false);
  kicker(s, '06 · IMPACT & CLOSING');
  title(s, 'A map that answers, not one that just displays.');
  const quads = [
    ['FiTrendingUp', 'Benefits', ['Less risk of the wrong location', 'Data, not hunches, for small firms', 'Every figure traceable to its N']],
    ['FiGlobe', 'Applications', ['Investors screening transit sites', 'First-time owners near home', 'Any city: swap the transit data']],
    ['FiZap', 'Future development', [`Surveys for the ${F.unsurveyedCells} unscored cells`, 'Storefront quality from photos', 'Rent data, more types, mobile card']],
    ['FiCheckCircle', 'Conclusion', ['Three signals, one catchment score', 'Insight, not raw points on a map', "Don't guess. Ask the map."]]
  ];
  quads.forEach(([ic, h, items], i) => {
    const x = 0.6 + (i % 2) * 6.2, y = 2.05 + Math.floor(i / 2) * 2.45, w = 5.93, hh = 2.25;
    card(s, x, y, w, hh);
    hexIcon(s, x + 0.2, y + 0.18, 0.55, ic);
    text(s, h, { x: x + 0.9, y: y + 0.2, w: w - 1.1, h: 0.5, fontSize: 20, bold: true, color: INK, valign: 'middle' });
    bullets(s, items, { x: x + 0.2, y: y + 0.82, w: w - 0.4, h: 1.4 });
  });
  s.addNotes('35 seconds. Benefits: less risk, small businesses that can compete on data, and figures that can be audited. Applications: investors, franchise teams, first-time owners, and any city with transit data. Next: more field surveys to cover the 100 unscored cells, photo classification for formality and storefront quality, rent listings. Conclusion: three signals in one catchment score, insight rather than raw points. Don\'t guess where to open. Ask the map.');
}

/* ── 8 · Closing ──────────────────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addImage({ path: img('map-3d.png'), x: 6.9, y: 0, w: 6.43, h: 7.5, sizing: { type: 'cover', w: 6.43, h: 7.5 }, transparency: 62 });
  s.addImage({ path: path.join(ASSETS, 'mark-white.png'), x: 0.7, y: 0.65, w: 0.7, h: 0.7 });
  text(s, 'SpotOn', { x: 1.5, y: 0.65, w: 3, h: 0.7, fontSize: 30, bold: true, color: WHITE, valign: 'middle' });
  text(s, 'Thank you.', { x: 0.7, y: 1.75, w: 6, h: 0.9, fontSize: 44, bold: true, color: WHITE });
  text(s, "Don't guess where to open. Ask the map.", { x: 0.7, y: 2.65, w: 6.1, h: 0.8, fontSize: 22, color: PALE });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 3.55, w: 2.3, h: 2.3, fill: { color: WHITE }, line: { color: WHITE, width: 0 }, rectRadius: 0.15 });
  s.addImage({ path: path.join(ASSETS, 'qr.png'), x: 0.85, y: 3.7, w: 2.0, h: 2.0 });
  text(s, 'Scan to open the WebGIS', { x: 3.25, y: 3.55, w: 3.6, h: 0.4, fontSize: 18, color: PALE });
  text(s, 'spot-on-three.\nvercel.app', { x: 3.25, y: 3.95, w: 3.6, h: 1.0, fontSize: 24, bold: true, color: WHITE });
  text(s, 'github.com/VennethN/SpotOn', { x: 3.25, y: 5.0, w: 3.6, h: 0.6, fontSize: 18, color: '8FB8F0' });
  text(s, 'Team Triple T, Universitas Bina Nusantara', { x: 0.7, y: 6.1, w: 6.2, h: 0.4, fontSize: 18, bold: true, color: WHITE });
  text(s, 'Valent Nathanael, Farhan Aulianda, Anthony Gilles Rudolfo', { x: 0.7, y: 6.5, w: 6.2, h: 0.6, fontSize: 18, color: PALE });
  s.addNotes('Close in 10 seconds and invite questions. The QR code opens the live WebGIS. The 15-minute Q&A follows.');
}

pres.writeFile({ fileName: 'SpotOn_Pitch_Deck.pptx' }).then((f) => console.log('written', f));
