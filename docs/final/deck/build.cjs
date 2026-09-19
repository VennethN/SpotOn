const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const F = JSON.parse(fs.readFileSync('../assets/figures.json', 'utf8'));
const CROPS = path.resolve('../crops');
const ASSETS = path.resolve('../assets');
const img = (n) => path.join(CROPS, n);
const num = (v) => v.toLocaleString('en-US');

const INK = '0B0C0E', INK2 = '3A3D45', MUTED = '7A7F88', WHITE = 'FFFFFF', DARK = '0B0C0E', BLUE = '0071E3', PALE = 'C9CDD4', SOFT = 'F2F3F5';
const FONT = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Team Triple T';
pres.title = 'SpotOn · Final pitch · MAPID WebGIS Competition 2026';

function text(slide, t, o) {
  slide.addText(t, { fontFace: FONT, fontSize: 20, color: INK2, isTextBox: true, margin: 0, valign: 'top', align: 'left', ...o });
}
function label(slide, t, dark) {
  text(slide, t, { x: 0.8, y: 0.55, w: 8, h: 0.35, fontSize: 18, color: dark ? PALE : MUTED, charSpacing: 1.5 });
}
function headline(slide, t, o = {}) {
  text(slide, t, { x: 0.8, y: 1.0, w: o.w || 6.2, h: o.h || 1.9, fontSize: o.size || 38, bold: true, color: o.color || INK, valign: 'top' });
}
function brand(slide, dark) {
  slide.addImage({ path: path.join(ASSETS, dark ? 'mark-white.png' : 'mark-ink.png'), x: 11.55, y: 0.52, w: 0.4, h: 0.4 });
  text(slide, 'SpotOn', { x: 12.0, y: 0.52, w: 1.2, h: 0.4, fontSize: 18, bold: true, color: dark ? WHITE : INK, valign: 'middle' });
}
function lead(slide, items, o) {
  // short lines with a bold lead-in, no bullets, no icons
  slide.addText(items.flatMap(([b, r], i) => [
    { text: b + ' ', options: { bold: true, color: INK } },
    { text: r, options: { color: INK2, breakLine: i < items.length - 1 } }
  ]).map((run) => ({ ...run, options: { ...run.options, paraSpaceAfter: 10 } })), { fontFace: FONT, fontSize: 20, isTextBox: true, margin: 0, valign: 'top', ...o });
}

/* 1 · Opener */
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addImage({ path: img('hero.png'), x: 5.4, y: 0, w: 7.93, h: 7.5, sizing: { type: 'cover', w: 7.93, h: 7.5 } });
  s.addImage({ path: path.join(ASSETS, 'mark-white.png'), x: 0.8, y: 0.7, w: 0.62, h: 0.62 });
  text(s, 'SpotOn', { x: 1.55, y: 0.7, w: 3, h: 0.62, fontSize: 28, bold: true, color: WHITE, valign: 'middle' });
  text(s, "Don't guess\nwhere to open.\nAsk the map.", { x: 0.8, y: 2.0, w: 4.8, h: 2.7, fontSize: 42, bold: true, color: WHITE });
  text(s, "The map that tells small businesses where to open around Jakarta's stations, and why.", { x: 0.8, y: 4.75, w: 4.4, h: 1.1, fontSize: 20, color: PALE });
  text(s, 'Team Triple T, Universitas Bina Nusantara', { x: 0.8, y: 6.15, w: 4.6, h: 0.6, fontSize: 18, bold: true, color: WHITE });
  text(s, 'MAPID WebGIS Competition 2026, Final', { x: 0.8, y: 6.7, w: 4.6, h: 0.5, fontSize: 18, color: '8FB8F0' });
  s.addNotes('15 seconds. "Every week in Jakarta, somebody signs a lease on a hunch. We built the map they should have asked first. We are Triple T, and this is SpotOn." If you want the BINUS logo, place it top right in Canva.');
}

/* 2 · Problem & Background */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'Problem and background');
  headline(s, 'Every week, someone signs a lease on a hunch.');
  text(s, 'You want to open a coffee shop near the station. Everyone says the area is busy. Nobody can tell you which corner, who you are up against, or whether there is even a shop to rent. So you guess. Too many guess wrong, and it is their savings that go.', { x: 0.8, y: 3.05, w: 5.9, h: 2.6, fontSize: 20 });
  text(s, 'Built for the people who take that risk: first-time owners, small businesses, franchise teams and investors.', { x: 0.8, y: 5.85, w: 5.9, h: 1.0, fontSize: 18, color: MUTED });
  s.addImage({ path: img('hero-plot-r.png'), x: 7.45, y: 1.05, w: 5.08, h: 5.2 });
  text(s, 'That outlined plot is still empty. It could be your shop.', { x: 7.45, y: 6.4, w: 5.08, h: 0.7, fontSize: 18, color: MUTED });
  s.addNotes('35 seconds. Tell it as a story: a first-time owner, a busy station, and three questions nobody can answer. Which corner is actually busy? Who is already there? Is there a shop to rent at all? Today the answer is a guess, and a wrong guess costs a family its savings. That is the problem, and those are the people we built this for.');
}

/* 3 · Solution & Concept */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'Solution and concept');
  headline(s, 'Ask the map, in your own words.', { w: 5.8 });
  text(s, 'Type what you want to open. SpotOn answers with the best spots around Jakarta\'s stations and why, like a friend who has walked every street.', { x: 0.8, y: 3.05, w: 5.8, h: 1.4, fontSize: 20 });
  lead(s, [['Is it busy?', 'We counted.'], ['Who is already there?', 'We know them by name.'], ['Space to rent?', 'Only spots with space qualify.']], { x: 0.8, y: 4.5, w: 5.9, h: 1.9 });
  text(s, 'From a hunch to a shortlist, in one question.', { x: 0.8, y: 6.42, w: 5.9, h: 0.8, fontSize: 20, bold: true, color: BLUE });
  s.addImage({ path: img('ask-r.png'), x: 6.9, y: 0.95, w: 5.63, h: 4.57 });
  text(s, 'Tapak, the guide inside the map, answers in Indonesian or English.', { x: 6.9, y: 5.65, w: 5.63, h: 0.7, fontSize: 18, color: MUTED });
  s.addNotes('35 seconds. The idea in one line: you ask, the map answers. Objective: cover the three questions a site visit is meant to answer, in one place, in plain language. Value: a shortlist you can defend, in minutes, with no GIS skills. Tapak is the guide who does the talking.');
}

/* 4 · Data & Methodology */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'Data and methodology');
  headline(s, 'We count what is really there.', { w: 5.8 });
  text(s, 'Every shop around every station, every unit on the market, and notes from people who walked the streets with MAPID Apps.', { x: 0.8, y: 3.05, w: 5.7, h: 1.3, fontSize: 20 });
  text(s, 'Jakarta is cut into walkable cells. Each cell gets one score per kind of business: how busy it is, minus your rivals, only where there is space to rent, with a boost for transit. The AI writes the sentence. It never invents a number.', { x: 0.8, y: 4.35, w: 5.7, h: 2.15, fontSize: 20 });
  text(s, `${num(F.hexes)} station areas · ${num(F.mapidPoints)} businesses · ${num(F.mission.records)} field notes · MAPID and OpenStreetMap`, { x: 0.8, y: 6.55, w: 11.7, h: 0.5, fontSize: 18, color: MUTED });
  s.addImage({ path: img('coverage-card-r.png'), x: 7.0, y: 1.6, w: 5.53, h: 3.58 });
  text(s, 'Every cell around a Jakarta station, counted one by one.', { x: 7.0, y: 5.3, w: 5.53, h: 0.7, fontSize: 18, color: MUTED });
  s.addNotes('40 seconds. Keep it light. Three sources, in plain words: the MAPID catalogue for the shops, the property catalogue for the space, and the MAPID Apps missions our community walked. Method in one breath: walkable cells, one score per business type, busy minus rivals, gated by space, boosted by transit. The AI understands the question and writes the answer. Every number is computed from the data, never by the model.');
}

/* 5 · WebGIS Features */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'WebGIS features');
  headline(s, 'Everything a site visit tells you, before you go.', { w: 8.0 });
  s.addImage({ path: img('app-rank-r.png'), x: 0.8, y: 3.05, w: 6.9, h: 3.88 });
  lead(s, [['Ask,', 'and the city recolours.'], ['Open any area', 'and see why.'], ['Pick a real shop', 'to rent, not a hexagon.']], { x: 8.1, y: 3.15, w: 4.4, h: 2.6 });
  text(s, 'Indonesian or English. Laptop or phone. Free to look around.', { x: 8.1, y: 5.85, w: 4.4, h: 1.0, fontSize: 18, color: MUTED });
  s.addNotes('40 seconds. This is the live product, and it is what you will see at the booth. Ask, and the whole city recolours for your business. Click an area and the card explains the score. Switch to By place and you are choosing between real shops on the market, with the walk to the station. It works in Indonesian and English, on a laptop or a phone.');
}

/* 6 · Results & Insights */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'Results and insights');
  const top = F.kopiTop5[0], t = F.kopiTypology;
  headline(s, `Ask for a coffee shop. SpotOn says ${top.name}.`, { w: 6.0, h: 1.9 });
  text(s, `A busy street with only ${top.osm} coffee shops, ${top.units} units up for rent and four transit stops within a walk. The best gap in the city, scored ${top.score} out of 100.`, { x: 0.8, y: 3.05, w: 5.9, h: 1.6, fontSize: 20 });
  text(s, `It also says where not to go: ${t.saturated} areas are already full of coffee shops. And where nobody has looked yet, it says so instead of guessing.`, { x: 0.8, y: 4.7, w: 5.9, h: 1.5, fontSize: 20 });
  text(s, 'Every number on screen comes from the data, never from the AI.', { x: 0.8, y: 6.25, w: 5.9, h: 0.6, fontSize: 18, color: MUTED });
  s.addImage({ path: img('map-3d-r.png'), x: 7.2, y: 0.95, w: 5.33, h: 4.18 });
  s.addImage({ path: img('area-breakdown-r.png'), x: 7.2, y: 5.3, w: 1.1, h: 1.59 });
  text(s, 'The city, scored for coffee shops, and the card that explains one answer.', { x: 8.5, y: 5.35, w: 4.0, h: 1.2, fontSize: 18, color: MUTED });
  s.addNotes('40 seconds. One real answer, told as a story. Ask for a coffee shop and SpotOn names Rawa Selatan: a busy street, five rivals, twelve units for rent, four stops. It scores 65, the best gap on the grid. Then the two things a hunch never tells you: where the market is already full, and where nobody has surveyed yet. That honesty is the product.');
}

/* 7 · Impact & Closing */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  brand(s, false);
  label(s, 'Impact and closing');
  headline(s, 'Fewer wrong leases. More shops that last.', { w: 7.0, h: 1.9 });
  lead(s, [
    ['Benefits.', 'A shortlist you can defend, in minutes, with no GIS skills.'],
    ['Applications.', 'First shops, franchise expansion, agents matching tenants, and any city with a transit map.'],
    ['Next.', 'More streets walked, rent listings, and Bandung and Surabaya.'],
    ['Conclusion.', "Don't guess where to open. Ask the map."]
  ], { x: 0.8, y: 3.05, w: 7.0, h: 3.8 });
  s.addImage({ path: img('why-r.png'), x: 8.6, y: 0.95, w: 2.62, h: 5.85 });
  text(s, 'Every answer comes with its reasons.', { x: 11.35, y: 5.6, w: 1.6, h: 1.2, fontSize: 18, color: MUTED });
  s.addNotes('30 seconds. Impact: fewer wrong leases, and small owners competing on the same information the chains buy. Applications from a first shop to a franchise roll-out, and the grid moves to any city with a transit map. Next: more streets walked with MAPID Apps, rent listings, and two more cities. Close on the line.');
}

/* 8 · Closing */
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  s.addImage({ path: img('map-3d.png'), x: 6.9, y: 0, w: 6.43, h: 7.5, sizing: { type: 'cover', w: 6.43, h: 7.5 }, transparency: 62 });
  s.addImage({ path: path.join(ASSETS, 'mark-white.png'), x: 0.8, y: 0.7, w: 0.62, h: 0.62 });
  text(s, 'SpotOn', { x: 1.55, y: 0.7, w: 3, h: 0.62, fontSize: 28, bold: true, color: WHITE, valign: 'middle' });
  text(s, 'Ask the map.', { x: 0.8, y: 1.9, w: 6, h: 1.0, fontSize: 44, bold: true, color: WHITE });
  text(s, 'Thank you. Come and ask it something at our booth.', { x: 0.8, y: 2.9, w: 5.6, h: 0.8, fontSize: 20, color: PALE });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: 3.9, w: 2.2, h: 2.2, fill: { color: WHITE }, line: { color: WHITE, width: 0 }, rectRadius: 0.15 });
  s.addImage({ path: path.join(ASSETS, 'qr.png'), x: 0.95, y: 4.05, w: 1.9, h: 1.9 });
  text(s, 'spot-on-three.\nvercel.app', { x: 3.3, y: 4.0, w: 3.4, h: 1.0, fontSize: 24, bold: true, color: WHITE });
  text(s, 'Free to open, on a laptop or a phone.', { x: 3.3, y: 5.05, w: 3.4, h: 0.7, fontSize: 18, color: PALE });
  text(s, 'Team Triple T, Universitas Bina Nusantara', { x: 0.8, y: 6.3, w: 6.0, h: 0.4, fontSize: 18, bold: true, color: WHITE });
  text(s, 'Valent Nathanael, Farhan Aulianda, Anthony Gilles Rudolfo', { x: 0.8, y: 6.7, w: 6.0, h: 0.6, fontSize: 18, color: PALE });
  s.addNotes('10 seconds. Invite the judges to ask the map something at the booth. Then questions.');
}

pres.writeFile({ fileName: 'SpotOn_Pitch_Deck.pptx' }).then((f) => console.log('written', f));
