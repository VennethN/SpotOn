/**
 * The marks the map draws, generated as canvas images.
 *
 * Three shapes, and the shapes carry the meaning rather than the colours: a square for a
 * competitor, a diamond for a unit on the market, a hatch for a cell with no data. The
 * palette already spends red on competitors and four more colours on transit modes, so a
 * fifth red circle would be the same mark to anyone not holding a swatch, and closer
 * still to a reader with a colour vision deficiency.
 *
 * Each takes its colours through `cssVar` rather than reading the document itself, so
 * they are callable from a test, and so the caller stays responsible for regenerating
 * them when the theme changes — MapLibre clears its image registry on `setStyle`, and a
 * mark baked in the old theme's colours would otherwise survive into the new one.
 */

/** Reads a CSS custom property. The map paints on a canvas and cannot resolve one. */
export type CssVar = (name: string) => string;

export function hatchImage(cssVar: CssVar): ImageData {
	const size = 10;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = cssVar('--fill-1') || 'rgba(120,128,140,0.1)';
	ctx.fillRect(0, 0, size, size);
	ctx.strokeStyle = cssVar('--nodata');
	ctx.globalAlpha = 0.5;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(-size, size);
	ctx.lineTo(size, -size);
	ctx.moveTo(0, size * 2);
	ctx.lineTo(size * 2, 0);
	ctx.stroke();
	return ctx.getImageData(0, 0, size, size);
}

/**
 * The cell polygons.
 *
 * Built from the BASE grid, not from scored rows, so the map draws the moment the
 * page has its geometry — before any category has been chosen, and whether or not
 * the heatmap is on. Scores, when there are any, only decide the fill colour.
 *
 * Every colour is read once here rather than inside the loop. `cssVar` calls
 * `getComputedStyle(document.documentElement)`, and doing that per feature meant
 * 562 forced style recalculations for a palette of nine colours that is identical
 * on every one of them — on every weight change, every hover, every selection.
 */

export function rivalImage(cssVar: CssVar): { data: ImageData; pixelRatio: number } {
	const size = 16;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	const inset = 2.5;
	const side = size - inset * 2;
	ctx.fillStyle = cssVar('--bg-elevated') || '#ffffff';
	ctx.strokeStyle = cssVar('--bg-elevated') || '#ffffff';
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeRect(inset, inset, side, side);
	ctx.fillStyle = cssVar('--critical');
	ctx.fillRect(inset, inset, side, side);
	return { data: ctx.getImageData(0, 0, size, size), pixelRatio: 2 };
}

/**
 * The property mark: a diamond, and a third shape on purpose.
 *
 * The map already spends a square on competitors and circles on transit nodes, and
 * this is neither. It is a doorway the reader could walk into and take, which is the
 * opposite kind of thing from a rival and a different kind of thing from a station.
 *
 * Colour cannot carry it alone here any more than it could for the competitors. The
 * palette's five other map colours are all spoken for — red for rivals, and orange,
 * red, green and mauve for the four transit modes — so a diamond in `--warn` is told
 * apart by its shape first and its colour second, which is the order that survives a
 * colour vision deficiency.
 *
 * Hollow rather than filled. A filled mark at this size reads as another data point
 * competing with the rivals for attention, and these are not competing with anything:
 * they are the vacancies among them. The knockout ring is there for the same reason
 * the transit plate is, because this sits on a heatmap fill that changes cell to cell.
 */

export function unitImage(cssVar: CssVar): { data: ImageData; pixelRatio: number } {
	const size = 18;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	const mid = size / 2;
	const r = mid - 3;
	const diamond = () => {
		ctx.beginPath();
		ctx.moveTo(mid, mid - r);
		ctx.lineTo(mid + r, mid);
		ctx.lineTo(mid, mid + r);
		ctx.lineTo(mid - r, mid);
		ctx.closePath();
	};
	// The knockout first and the mark over it, so the ring is a border rather than a
	// halo sitting on top of the shape it is meant to lift off the map.
	diamond();
	ctx.lineWidth = 4;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = cssVar('--bg-elevated') || '#ffffff';
	ctx.stroke();
	ctx.fillStyle = cssVar('--bg-elevated') || '#ffffff';
	ctx.fill();
	diamond();
	ctx.lineWidth = 2.2;
	ctx.strokeStyle = cssVar('--warn');
	ctx.stroke();
	return { data: ctx.getImageData(0, 0, size, size), pixelRatio: 2 };
}

/**
 * The units on the market in the selected cell, at their real addresses.
 *
 * The panel gives one number for the whole catchment — the median asking price per
 * m² — and a number like that is only actionable once the reader can see which
 * doorways it was taken over. Two shophouses on the main road and eight on a lane
 * behind it produce the same median and are not the same choice.
 *
 * PREMISES ONLY
 *
 * Warehouses, office floors and whole buildings are on the market too and are counted
 * in the panel, but they are not somewhere to open a coffee shop. Drawing them here
 * would put marks on the map the reader cannot act on, next to marks they can, with
 * nothing on screen separating the two. The panel says how many of each there are.
 *
 * Every unit carries its type and, where the listing published one, its asking price
 * — which is a price to BUY. The catalogue has no rent, and `domain/cost` holds the
 * measurement that says so.
 */
