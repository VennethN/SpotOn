/**
 * A model of ONE AREA, built from the basemap's own geometry.
 *
 * The block this replaces was a composed street: one cafe, one stop, a few lots,
 * standing for every cell with only the counts varying. This is the place itself. The
 * building footprints, streets, water and parks are the basemap's, read off its tiles
 * by `domain/basemap` and cut to a disc of the walking radius around the point the
 * range is measured from. Whichever basemap the map is on is what stands here, so the
 * model is a recreation of the map on screen and never of some other map.
 *
 * Four decisions bind it, and three of them are the schematic's own:
 *
 * 1. **Isometric.** An orthographic camera, above and to the south, so that north is
 *    up the way it is on the map. What is on offer is the relationship between the
 *    streets, the stops and the shops, and an orthographic projection shows that
 *    without perspective distortion.
 * 2. **White, with a legend.** The masses are white and lit only by the hour. The only
 *    saturated colours are the map's own marks, worn by small objects and never by a
 *    building: MRT orange, KRL red, LRT green, TransJakarta pink, competitors' red,
 *    units' amber, and the accent for the point the range is measured from.
 * 3. **Nothing is invented.** A building stands at the height the tile carries. A mark
 *    stands where the catalogue put it. Where the doors were not counted, no door is
 *    drawn. A frame is drawn only when the state changes.
 * 4. **The hour lights doors, not people.** The schematic sculpted a crowd and scaled
 *    it by the doors counted open. At the scale of a real 800 m disc a person is one
 *    pixel, and drawing them ten times life size would be a claim about where people
 *    stand that nobody counted. So the doors themselves are drawn, one mark each at
 *    the position OpenStreetMap holds for the business, lit when its published hours
 *    say it is open in the hour on the slider and dark when they do not. The count is
 *    the same count the panel prints. It is only drawn where it was taken.
 */

import * as THREE from 'three';
import type { AreaGeometry, AreaMarks, LocalPoint, RoadKind, TransitCounts } from '$lib/types';
import { ROAD_WIDTH } from '$lib/domain/basemap';
import { clipPathToDisc, ringArea } from '$lib/utils/geo';
import { daylightAt, type DaylightSample } from './daylight';

type AreaStop = AreaMarks['stops'][number];
type AreaFieldMark = AreaMarks['field'][number];
type AreaDoor = AreaMarks['doors'][number];

export interface AreaState {
	/** 0..24 */
	hour: number;
	/** 0..6, Monday first: which day's timetables the doors follow. */
	day: number;
	/** 0..1, position along the camera track: the whole disc, closing in on the centre. */
	cameraT: number;
	/** Radians the camera has been turned around the point, by hand or on its own. */
	spin: number;
	/** The catalogue has never read this cell's city: the ground is hatched. */
	nodata: boolean;
	/** The walking radius, in metres. The disc is this big. */
	radius: number;
	/** What the basemap holds inside the disc. Null while it is still on its way. */
	geometry: AreaGeometry | null;
	/** The selected cell's own boundary, in metres, drawn on the ground. */
	boundary: LocalPoint[];
	stops: AreaStop[];
	rivals: LocalPoint[];
	units: LocalPoint[];
	field: AreaFieldMark[];
	doors: AreaDoor[];
}

/** Where each mark stands and how big it is, in screen pixels. */
interface MarkLayout {
	posts: Array<{ x: number; y: number; h: number }>;
	discs: Array<{ x: number; y: number; r: number; h: number }>;
	squares: Array<{ x: number; y: number; h: number }>;
	diamonds: Array<{ x: number; y: number; h: number; stacked: number }>;
	rings: Array<{ x: number; y: number; h: number }>;
}

const DEFAULT_STATE: AreaState = {
	hour: 12,
	day: 0,
	cameraT: 0,
	spin: 0,
	nodata: false,
	radius: 800,
	geometry: null,
	boundary: [],
	stops: [],
	rivals: [],
	units: [],
	field: [],
	doors: []
};

const WHITE = new THREE.Color(0xffffff);

/**
 * The only saturated colours in this scene, and they are the map's own.
 *
 * A reader arrives here from a map drawing the MRT orange and TransJakarta pink, with
 * the competitors as red squares and the units on the market as amber diamonds.
 * Picking new ones for the model would mean learning the legend twice, so the marks
 * wear the very same colours and the very same shapes.
 */
const MODE_COLOUR: Record<keyof TransitCounts, number> = {
	mrt: 0xef8f3c,
	krl: 0xe05a5a,
	lrt: 0x46b077,
	brt: 0xc76bbe
};
const RIVAL_COLOUR = 0xd1352b;
const UNIT_COLOUR = 0xb5610a;
const FIELD_COLOUR = 0x2b2f36;
const ACCENT = 0x0071e3;
/** A door the timetable says is open at this hour, and one it says is shut. */
const DOOR_OPEN = new THREE.Color(0xffb84d);
const DOOR_SHUT = new THREE.Color(0x4a4f57);

/**
 * Which grey each class of street is laid in, how high above the ground, and whether
 * it gets lamps. The widths come from `domain/basemap`, shared with the map's own
 * modelled rendition so the two agree about every street.
 */
const ROAD: Record<RoadKind, { colour: number; y: number; lamps: boolean }> = {
	motorway: { colour: 0xb2aea7, y: 0.22, lamps: true },
	trunk: { colour: 0xb2aea7, y: 0.2, lamps: true },
	primary: { colour: 0xb6b2ab, y: 0.18, lamps: true },
	secondary: { colour: 0xb6b2ab, y: 0.16, lamps: true },
	tertiary: { colour: 0xbbb7b0, y: 0.14, lamps: true },
	minor: { colour: 0xc0bcb5, y: 0.12, lamps: true },
	service: { colour: 0xc5c1ba, y: 0.1, lamps: false },
	track: { colour: 0xcbc7c0, y: 0.09, lamps: false },
	path: { colour: 0xcfcbc4, y: 0.08, lamps: false },
	busway: { colour: 0xaca8a1, y: 0.19, lamps: false },
	rail: { colour: 0x8f8d88, y: 0.24, lamps: false },
	transit: { colour: 0x8f8d88, y: 0.24, lamps: false }
};
/** How far a bridge is carried above the ground it crosses. */
const BRIDGE_LIFT = 4;
/** How far apart the street lamps stand. */
const LAMP_PITCH = 30;
/** How wide a transit corridor is laid over the street, in metres. */
const ROUTE_WIDTH: Record<keyof TransitCounts, number> = { mrt: 6, krl: 6, lrt: 5, brt: 5 };

const GROUND_COLOUR = 0xd6d2cb;
const SLAB_COLOUR = 0xdcd8d1;
const WATER_COLOUR = 0xb3c3cd;
const GREEN_COLOUR = 0xc4cfb7;

/** A 45° hatch for the ground of an unsurveyed cell, drawn once and tiled. */
function makeHatchTexture(): THREE.CanvasTexture {
	const S = 64;
	const c = document.createElement('canvas');
	c.width = S;
	c.height = S;
	const g = c.getContext('2d');
	if (g) {
		g.fillStyle = '#d6d2cb';
		g.fillRect(0, 0, S, S);
		g.strokeStyle = '#b9b5ae';
		g.lineWidth = 3;
		g.beginPath();
		for (let i = 0; i <= S * 2; i += 16) {
			g.moveTo(i, 0);
			g.lineTo(i - S, S);
		}
		g.stroke();
	}
	const t = new THREE.CanvasTexture(c);
	t.wrapS = THREE.RepeatWrapping;
	t.wrapT = THREE.RepeatWrapping;
	return t;
}

/** A soft round sprite for the door marks, so a point is a dot and not a square. */
function makeDotTexture(): THREE.CanvasTexture {
	const S = 32;
	const c = document.createElement('canvas');
	c.width = S;
	c.height = S;
	const g = c.getContext('2d');
	if (g) {
		g.fillStyle = '#ffffff';
		g.beginPath();
		g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
		g.fill();
	}
	return new THREE.CanvasTexture(c);
}

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/* ── geometry builders ───────────────────────────────────────────────────────
   Everything below turns metres east and north into three.js space, where x is
   east, y is up and z is SOUTH, so a point (x, y) on the plan lands at (x, h, -y).
   Front faces are wound to face outwards and upwards, which is what lets every mass
   keep its normals and the light stay honest about which way a wall faces. */

/**
 * A growing indexed mesh: positions, and per vertex either a normal and a colour or
 * one extra float, whichever the mesh is built with.
 *
 * The walls carry no normals at all. Forty thousand buildings is over a million
 * vertices, and a normal on each is fourteen megabytes the flat-shaded material can
 * derive for itself from the triangle it is drawing. What a wall vertex carries is
 * one float: the building's seed, plus two when the vertex is on the roof.
 */
class MeshSink {
	pos: number[] = [];
	nrm: number[] = [];
	col: number[] = [];
	extra: number[] = [];
	idx: number[] = [];

	get count(): number {
		return this.pos.length / 3;
	}

	vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, extra = 0, col?: THREE.Color): number {
		this.pos.push(x, y, z);
		if (col) {
			this.nrm.push(nx, ny, nz);
			this.col.push(col.r, col.g, col.b);
		} else {
			this.extra.push(extra);
		}
		return this.count - 1;
	}

	/** A triangle, wound so that its face points along `up` (the side the light sees). */
	tri(a: number, b: number, c: number, up: THREE.Vector3): void {
		const p = this.pos;
		const ax = p[a * 3];
		const ay = p[a * 3 + 1];
		const az = p[a * 3 + 2];
		const abx = p[b * 3] - ax;
		const aby = p[b * 3 + 1] - ay;
		const abz = p[b * 3 + 2] - az;
		const acx = p[c * 3] - ax;
		const acy = p[c * 3 + 1] - ay;
		const acz = p[c * 3 + 2] - az;
		const nx = aby * acz - abz * acy;
		const ny = abz * acx - abx * acz;
		const nz = abx * acy - aby * acx;
		if (nx * up.x + ny * up.y + nz * up.z >= 0) this.idx.push(a, b, c);
		else this.idx.push(a, c, b);
	}

	geometry(withColour: boolean, extraName: string | null): THREE.BufferGeometry {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		if (withColour) {
			g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
			g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
		}
		if (extraName) g.setAttribute(extraName, new THREE.Float32BufferAttribute(this.extra, 1));
		g.setIndex(this.idx);
		g.computeBoundingSphere();
		return g;
	}
}

const UP = new THREE.Vector3(0, 1, 0);

/** Consecutive repeats dropped, which a ribbon cannot be built through. */
function tidyPath(path: LocalPoint[]): LocalPoint[] {
	const out: LocalPoint[] = [];
	for (const p of path) {
		const last = out[out.length - 1];
		if (last && Math.abs(last.x - p.x) < 0.05 && Math.abs(last.y - p.y) < 0.05) continue;
		out.push(p);
	}
	return out;
}

/**
 * A flat ribbon along a path, mitred at the corners.
 *
 * The mitre is capped at twice the half width, so a hairpin bend does not throw a
 * spike out across the block. Past the cap the corner is simply blunt, which at the
 * scale of a street is invisible.
 */
function ribbon(sink: MeshSink, path: LocalPoint[], width: number, y: number, col: THREE.Color): void {
	const pts = tidyPath(path);
	const n = pts.length;
	if (n < 2) return;
	const half = width / 2;
	const left: number[] = [];
	const right: number[] = [];
	for (let i = 0; i < n; i++) {
		const prev = pts[Math.max(0, i - 1)];
		const next = pts[Math.min(n - 1, i + 1)];
		const d1x = pts[i].x - prev.x;
		const d1y = pts[i].y - prev.y;
		const d2x = next.x - pts[i].x;
		const d2y = next.y - pts[i].y;
		const l1 = Math.hypot(d1x, d1y) || 1;
		const l2 = Math.hypot(d2x, d2y) || 1;
		// The normals of the two segments meeting here, and their mean.
		const n1x = i === 0 ? -d2y / l2 : -d1y / l1;
		const n1y = i === 0 ? d2x / l2 : d1x / l1;
		const n2x = i === n - 1 ? n1x : -d2y / l2;
		const n2y = i === n - 1 ? n1y : d2x / l2;
		let mx = n1x + n2x;
		let my = n1y + n2y;
		const ml = Math.hypot(mx, my);
		if (ml < 1e-6) {
			mx = n1x;
			my = n1y;
		} else {
			mx /= ml;
			my /= ml;
		}
		const scale = half / Math.max(0.5, mx * n2x + my * n2y);
		left.push(sink.vertex(pts[i].x + mx * scale, y, -(pts[i].y + my * scale), 0, 1, 0, 0, col));
		right.push(sink.vertex(pts[i].x - mx * scale, y, -(pts[i].y - my * scale), 0, 1, 0, 0, col));
	}
	for (let i = 0; i + 1 < n; i++) {
		sink.tri(left[i], right[i], right[i + 1], UP);
		sink.tri(left[i], right[i + 1], left[i + 1], UP);
	}
}

/** A ring's points as the triangulator takes them. */
const toVec2 = (ring: LocalPoint[]): THREE.Vector2[] => ring.map((p) => new THREE.Vector2(p.x, p.y));

/** The outer ring counter-clockwise and the holes clockwise, which is what the walls
    are built from: the outward normal of an edge is then always to its right. */
function orient(rings: LocalPoint[][]): LocalPoint[][] {
	return rings.map((r, i) => {
		const ccw = ringArea(r) >= 0;
		return (i === 0) === ccw ? r : r.slice().reverse();
	});
}

/** A flat polygon with holes, on the ground at `y`. */
function flat(sink: MeshSink, rings: LocalPoint[][], y: number, col: THREE.Color): void {
	const oriented = orient(rings);
	let tris: number[][];
	try {
		tris = THREE.ShapeUtils.triangulateShape(toVec2(oriented[0]), oriented.slice(1).map(toVec2));
	} catch {
		return;
	}
	const all = oriented.flat();
	const base = sink.count;
	for (const p of all) sink.vertex(p.x, y, -p.y, 0, 1, 0, 0, col);
	for (const [a, b, c] of tris) sink.tri(base + a, base + b, base + c, UP);
}

/** Twice the signed area of a triangle on the plan. */
const area2 = (a: LocalPoint, b: LocalPoint, c: LocalPoint): number =>
	(b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);

/**
 * A footprint cut into triangles.
 *
 * Most of a city is four-cornered, and for a plain quadrilateral the answer is one of
 * its two diagonals: the one that leaves both halves turning the same way as the ring
 * itself, which is the diagonal that lies inside. Everything else goes through the
 * general triangulator, which allocates a good deal per call and is what made the
 * first build of a dense kampung take most of a second.
 */
function triangulate(oriented: LocalPoint[][]): number[][] | null {
	const outer = oriented[0];
	if (oriented.length === 1 && outer.length === 3) return [[0, 1, 2]];
	if (oriented.length === 1 && outer.length === 4) {
		const [a, b, c, d] = outer;
		if (area2(a, b, c) > 0 && area2(a, c, d) > 0) return [[0, 1, 2], [0, 2, 3]];
		if (area2(b, c, d) > 0 && area2(b, d, a) > 0) return [[1, 2, 3], [1, 3, 0]];
	}
	try {
		return THREE.ShapeUtils.triangulateShape(toVec2(outer), oriented.slice(1).map(toVec2));
	} catch {
		return null;
	}
}

/**
 * A building: its footprint raised from `base` to `top`.
 *
 * Every vertex carries the building's seed, which the wall shader reads twice: once
 * for a faint variation in the grey, so a block of a hundred houses does not read as
 * one slab, and once to decide whether this building's windows are among the ones lit
 * at the hour on the slider. A roof vertex carries the seed plus two, which is how the
 * shader keeps the glow off the roofs without a normal to read.
 */
function extrude(sink: MeshSink, rings: LocalPoint[][], base: number, top: number, seed: number): void {
	const oriented = orient(rings);
	const outer = oriented[0];
	if (outer.length < 3) return;
	const tris = triangulate(oriented);
	if (!tris) return;
	// The roof.
	const all = oriented.flat();
	const roof = sink.count;
	for (const p of all) sink.vertex(p.x, top, -p.y, 0, 1, 0, seed + 2);
	for (const [a, b, c] of tris) sink.tri(roof + a, roof + b, roof + c, UP);
	// The walls, one quad per edge of every ring.
	const out = new THREE.Vector3();
	for (const ring of oriented) {
		const n = ring.length;
		for (let i = 0; i < n; i++) {
			const p = ring[i];
			const q = ring[(i + 1) % n];
			const dx = q.x - p.x;
			const dy = q.y - p.y;
			const len = Math.hypot(dx, dy);
			if (len < 1e-6) continue;
			// Outward is to the right of travel, which orientation above guaranteed.
			const nx = dy / len;
			const ny = -dx / len;
			out.set(nx, 0, -ny);
			const a = sink.vertex(p.x, base, -p.y, nx, 0, -ny, seed);
			const b = sink.vertex(q.x, base, -q.y, nx, 0, -ny, seed);
			const c = sink.vertex(q.x, top, -q.y, nx, 0, -ny, seed);
			const d = sink.vertex(p.x, top, -p.y, nx, 0, -ny, seed);
			sink.tri(a, b, c, out);
			sink.tri(a, c, d, out);
		}
	}
}

/** Points every `pitch` metres along a path. */
function alongPath(path: LocalPoint[], pitch: number, take: (p: LocalPoint) => void): void {
	let carry = pitch / 2;
	for (let i = 0; i + 1 < path.length; i++) {
		const p = path[i];
		const q = path[i + 1];
		const len = Math.hypot(q.x - p.x, q.y - p.y);
		let at = carry;
		while (at <= len) {
			const t = at / len;
			take({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
			at += pitch;
		}
		carry = at - len;
	}
}

export class AreaWorld {
	#renderer: THREE.WebGLRenderer;
	#scene = new THREE.Scene();
	#camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 1, 4000);
	#canvas: HTMLCanvasElement;

	#sun = new THREE.DirectionalLight(0xffffff, 1);
	#hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
	#fog = new THREE.FogExp2(0xdfe3e6, 0.0001);

	/** The slab, the ground and the cell's own boundary. Rebuilt when the radius moves. */
	#base = new THREE.Group();
	/** Everything the basemap holds. Rebuilt when the geometry is replaced. */
	#city = new THREE.Group();
	/** The catalogue's marks on posts. Rebuilt when any of the lists is replaced. */
	#marks = new THREE.Group();
	/** One dot per counted door, coloured by whether it is open at the hour. */
	#doors: THREE.Points | null = null;
	#doorColours: Float32Array | null = null;
	#lamps: THREE.Points | null = null;

	#groundMat = new THREE.MeshStandardMaterial({ color: GROUND_COLOUR, roughness: 0.96 });
	#hatch: THREE.CanvasTexture | null = null;
	#dot: THREE.CanvasTexture | null = null;
	/** The cell's boundary on the ground, dark by day and light by night. */
	#lineMat = new THREE.LineBasicMaterial({ color: 0x2a2f38, transparent: true, opacity: 0.85 });
	/** The wall shader's two dials: how many buildings are lit, and how brightly. */
	#uWindow = { value: 0 };
	#uGlow = { value: 0 };

	#state: AreaState = { ...DEFAULT_STATE };
	#day: DaylightSample = daylightAt(12);
	#built: {
		geometry: AreaGeometry | null;
		radius: number;
		boundary: LocalPoint[];
		doors: AreaDoor[];
		doorHour: string;
	} = { geometry: null, radius: -1, boundary: [], doors: [], doorHour: '' };

	#raf = 0;
	#running = false;
	#reduced: boolean;
	#dirty = true;
	#shadowSize = 2048;
	#viewWidth = 1800;
	/** Metres per screen pixel at the current framing: what the marks are sized by. */
	#mpp = 1;
	#dummy = new THREE.Object3D();
	#colour = new THREE.Color();

	constructor(canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean } = {}) {
		this.#canvas = canvas;
		this.#reduced = opts.reducedMotion ?? false;

		this.#renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance',
			alpha: true
		});
		// Its users are on mid-range Android phones with limited data. Full pixel and
		// shadow-map resolution on a small screen burns battery for no visible gain.
		const small = window.innerWidth < 768;
		this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
		this.#renderer.setClearAlpha(0);
		this.#renderer.shadowMap.enabled = true;
		this.#renderer.shadowMap.type = THREE.PCFShadowMap;
		this.#shadowSize = small ? 1024 : 2048;
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.#renderer.toneMappingExposure = 1.0;

		// The sky is a CSS gradient behind the canvas, not a dome inside the scene: in an
		// orthographic projection every ray is parallel, so a dome would be one flat
		// colour. The fog is set to the horizon colour so the far edge of the disc
		// dissolves into exactly that sky.
		this.#scene.fog = this.#fog;

		this.#sun.castShadow = true;
		this.#sun.shadow.mapSize.set(this.#shadowSize, this.#shadowSize);
		this.#sun.shadow.bias = -0.0004;
		this.#sun.shadow.normalBias = 0.6;
		this.#scene.add(this.#sun, this.#sun.target, this.#hemi, this.#base, this.#city, this.#marks);

		this.applyState({});
		this.resize();
	}

	/* ── the slab and the ground ─────────────────────────────────────────── */

	#buildBase(): void {
		this.#dispose(this.#base);
		const R = this.#state.radius;

		// A slab with visible thickness, which is what tells the eye it is looking at an
		// object on a table rather than a city photographed from a helicopter.
		const thick = R * 0.03;
		const slab = new THREE.Mesh(
			new THREE.CylinderGeometry(R, R, thick, 96),
			new THREE.MeshStandardMaterial({ color: SLAB_COLOUR, roughness: 0.95 })
		);
		slab.position.y = -thick / 2;
		slab.receiveShadow = true;
		this.#base.add(slab);

		const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 96), this.#groundMat);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = 0.002;
		ground.receiveShadow = true;
		this.#base.add(ground);
		if (this.#hatch) this.#hatch.repeat.set((R * 2) / 30, (R * 2) / 30);

		// The cell's own hexagon, cut to the disc where the disc is the smaller: at
		// 400 m the range sits well inside its cell.
		const ring = this.#state.boundary;
		if (ring.length >= 3) {
			const closed = [...ring, ring[0]];
			const pts: number[] = [];
			for (const piece of clipPathToDisc(closed, R * 0.999)) {
				for (let i = 0; i + 1 < piece.length; i++) {
					pts.push(piece[i].x, 0.6, -piece[i].y, piece[i + 1].x, 0.6, -piece[i + 1].y);
				}
			}
			if (pts.length) {
				const g = new THREE.BufferGeometry();
				g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
				this.#base.add(new THREE.LineSegments(g, this.#lineMat));
			}
		}

	}

	/* ── what the basemap holds ──────────────────────────────────────────── */

	#buildCity(): void {
		this.#dispose(this.#city);
		this.#lamps = null;
		const g = this.#state.geometry;
		if (!g) return;
		const rnd = mulberry32(20260907);

		/* Buildings: one mesh, however many there are. The seed per vertex is what the
		   shader below varies the grey by and lights the windows from. */
		const walls = new MeshSink();
		for (const b of g.buildings) {
			const top = Math.max(b.base + 0.5, b.height);
			extrude(walls, b.rings, b.base, top, rnd());
		}
		if (walls.count) {
			// Flat shaded, so the material derives each face's normal itself and the
			// geometry carries none: see `MeshSink`.
			const mat = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				roughness: 0.88,
				metalness: 0.02,
				flatShading: true
			});
			mat.customProgramCacheKey = () => 'spoton-area-walls';
			mat.onBeforeCompile = (shader) => {
				shader.uniforms.uWindow = this.#uWindow;
				shader.uniforms.uGlow = this.#uGlow;
				shader.vertexShader = shader.vertexShader
					.replace('#include <common>', '#include <common>\nattribute float aSeed;\nvarying float vSeed;')
					.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = aSeed;');
				shader.fragmentShader = shader.fragmentShader
					.replace(
						'#include <common>',
						'#include <common>\nuniform float uWindow;\nuniform float uGlow;\nvarying float vSeed;'
					)
					// Each building its own grey, the way the schematic's blocks each had one.
					// The seed is carried plus two on a roof vertex, so the two are read apart.
					.replace(
						'#include <color_fragment>',
						'#include <color_fragment>\nfloat roof = step(1.5, vSeed);\nfloat seed = vSeed - 2.0 * roof;\ndiffuseColor.rgb *= 0.84 + 0.12 * fract(seed * 7.31);'
					)
					// Windows: the walls of the buildings whose seed falls under tonight's share
					// glow warm. Roofs never do.
					.replace(
						'#include <emissivemap_fragment>',
						'#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.80, 0.55) * step(seed, uWindow) * (1.0 - roof) * uGlow;'
					);
			};
			const mesh = new THREE.Mesh(walls.geometry(false, 'aSeed'), mat);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			this.#city.add(mesh);
		}

		/* Water and green, flat on the ground, a hair above it. */
		const water = new MeshSink();
		this.#colour.setHex(WATER_COLOUR);
		for (const w of g.water) flat(water, w.rings, 0.06, this.#colour);
		for (const w of g.waterways) ribbon(water, w.path, w.width, 0.07, this.#colour);
		if (water.count) {
			const mesh = new THREE.Mesh(
				water.geometry(true, null),
				new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 })
			);
			mesh.receiveShadow = true;
			this.#city.add(mesh);
		}
		const green = new MeshSink();
		this.#colour.setHex(GREEN_COLOUR);
		for (const p of g.green) flat(green, p.rings, 0.04, this.#colour);
		if (green.count) {
			const mesh = new THREE.Mesh(
				green.geometry(true, null),
				new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
			);
			mesh.receiveShadow = true;
			this.#city.add(mesh);
		}

		/* Streets, as ribbons of their own width. The busier the street the higher it
		   is laid, by a few millimetres, so that where two cross the wider one shows. */
		const roads = new MeshSink();
		const lampSpots: number[] = [];
		for (const r of g.roads) {
			const spec = ROAD[r.kind];
			this.#colour.setHex(spec.colour);
			ribbon(roads, r.path, ROAD_WIDTH[r.kind], spec.y + (r.bridge ? BRIDGE_LIFT : 0), this.#colour);
			if (spec.lamps && !r.bridge) {
				alongPath(r.path, LAMP_PITCH, (p) => lampSpots.push(p.x, 7, -p.y));
			}
		}
		if (roads.count) {
			const mesh = new THREE.Mesh(
				roads.geometry(true, null),
				new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
			);
			mesh.receiveShadow = true;
			this.#city.add(mesh);
		}

		/* The transit corridors the map draws, laid over the streets in the map's own
		   colours. Unlit and untoned, so the pink is the map's pink at any hour. */
		const routes = new MeshSink();
		for (const r of g.routes) {
			this.#colour.setHex(MODE_COLOUR[r.mode]);
			ribbon(routes, r.path, ROUTE_WIDTH[r.mode], 0.5, this.#colour);
		}
		if (routes.count) {
			const mesh = new THREE.Mesh(
				routes.geometry(true, null),
				new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
			);
			this.#city.add(mesh);
		}

		/* Street lamps: a point of warm light every thirty metres down every street
		   that would have them, drawn only once the sun is down. */
		if (lampSpots.length) {
			const geo = new THREE.BufferGeometry();
			geo.setAttribute('position', new THREE.Float32BufferAttribute(lampSpots, 3));
			const mat = new THREE.PointsMaterial({
				color: 0xffd9a8,
				size: 3,
				sizeAttenuation: false,
				transparent: true,
				opacity: 0,
				depthWrite: false,
				toneMapped: false
			});
			this.#lamps = new THREE.Points(geo, mat);
			this.#lamps.frustumCulled = false;
			this.#city.add(this.#lamps);
		}
	}

	/* ── the catalogue's marks ───────────────────────────────────────────── */

	/** What stands where, sized in screen pixels: the unit every mark is drawn in. */
	#layout: MarkLayout = { posts: [], discs: [], squares: [], diamonds: [], rings: [] };
	#meshes: {
		posts: THREE.InstancedMesh | null;
		discs: THREE.InstancedMesh | null;
		squares: THREE.InstancedMesh | null;
		diamonds: THREE.InstancedMesh | null;
		rings: THREE.InstancedMesh | null;
		beacon: THREE.Group | null;
	} = { posts: null, discs: null, squares: null, diamonds: null, rings: null, beacon: null };
	#placedKey = '';

	/**
	 * One post per mark, with the map's own shape on top, turned to face the camera.
	 *
	 * Built once per set of marks, and PLACED as often as the framing moves. The marks
	 * are sized in screen pixels, through the metres each pixel holds, the way the map's
	 * own marks are: a mark sized in metres reads at one framing and vanishes at
	 * another, and the framing moves continuously while the reader zooms. Sizing is a
	 * matrix per instance, so placing a hundred marks again is nothing, where rebuilding
	 * them was a hundred geometries a frame.
	 */
	#buildMarks(): void {
		this.#dispose(this.#marks);
		const s = this.#state;
		const layout: MarkLayout = { posts: [], discs: [], squares: [], diamonds: [], rings: [] };

		// Stops: a disc in the mode's colour, rail larger, as on the map.
		for (const st of s.stops) {
			const rail = st.mode !== 'brt';
			const h = rail ? 20 : 15;
			layout.posts.push({ x: st.x, y: st.y, h });
			layout.discs.push({ x: st.x, y: st.y, r: rail ? 8 : 5.5, h });
		}
		// Competitors: the map's red square.
		for (const p of s.rivals) {
			layout.posts.push({ x: p.x, y: p.y, h: 14 });
			layout.squares.push({ x: p.x, y: p.y, h: 14 });
		}
		// Units on the market: the map's amber diamond. Several units share one
		// coordinate whenever the catalogue geocoded them to the street, so the second
		// and later ones stack up the same post rather than vanishing into the first.
		const seen = new Map<string, number>();
		for (const p of s.units) {
			const key = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
			const stacked = seen.get(key) ?? 0;
			seen.set(key, stacked + 1);
			if (!stacked) layout.posts.push({ x: p.x, y: p.y, h: 13 });
			layout.diamonds.push({ x: p.x, y: p.y, h: 13, stacked });
		}
		// Field records: the map's hollow ring, filled only for a place offered for rent.
		for (const f of s.field) {
			layout.posts.push({ x: f.x, y: f.y, h: 12 });
			layout.rings.push({ x: f.x, y: f.y, h: 12 });
		}
		this.#layout = layout;

		const instanced = (geometry: THREE.BufferGeometry, n: number, lit: boolean) => {
			if (!n) return null;
			const mesh = new THREE.InstancedMesh(
				geometry,
				lit
					? new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.7 })
					: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
				n
			);
			mesh.castShadow = lit;
			this.#marks.add(mesh);
			return mesh;
		};
		const m = this.#meshes;
		m.posts = instanced(new THREE.CylinderGeometry(0.45, 0.45, 1, 6), layout.posts.length, true);
		m.discs = instanced(new THREE.CylinderGeometry(1, 1, 1, 24), layout.discs.length, false);
		m.squares = instanced(new THREE.BoxGeometry(1, 1, 1), layout.squares.length, false);
		m.diamonds = instanced(new THREE.BoxGeometry(1, 1, 1), layout.diamonds.length, false);
		m.rings = instanced(new THREE.TorusGeometry(4, 1, 8, 24), layout.rings.length, false);
		// The colours, which do not move with the framing.
		s.stops.forEach((st, i) => m.discs?.setColorAt(i, this.#colour.setHex(MODE_COLOUR[st.mode])));
		layout.squares.forEach((_, i) => m.squares?.setColorAt(i, this.#colour.setHex(RIVAL_COLOUR)));
		layout.diamonds.forEach((_, i) => m.diamonds?.setColorAt(i, this.#colour.setHex(UNIT_COLOUR)));
		s.field.forEach((f, i) =>
			m.rings?.setColorAt(i, this.#colour.setHex(f.rent ? ACCENT : FIELD_COLOUR))
		);

		// The point the range is measured from: a beacon in the accent, unlit, so it
		// reads the same at midnight as at noon. Built at one pixel per unit and scaled
		// with the rest.
		const beacon = new THREE.Group();
		const accent = new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false });
		const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 26, 8), accent);
		post.position.y = 13;
		const head = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 12), accent);
		head.position.y = 27;
		const halo = new THREE.Mesh(new THREE.RingGeometry(7, 8.4, 48), accent);
		halo.rotation.x = -Math.PI / 2;
		halo.position.y = 0.7;
		beacon.add(post, head, halo);
		this.#marks.add(beacon);
		m.beacon = beacon;

		this.#placedKey = '';
		this.#placeMarks();
	}

	/** Every mark sized for the metres a pixel holds right now, and turned to the camera. */
	#placeMarks(): void {
		const k = this.#mpp;
		const yaw = this.#cameraYaw();
		const key = `${k.toFixed(4)}|${yaw.toFixed(4)}`;
		if (key === this.#placedKey) return;
		this.#placedKey = key;
		const m = this.#meshes;
		const l = this.#layout;
		const d = this.#dummy;
		const set = (mesh: THREE.InstancedMesh | null, i: number) => {
			if (!mesh) return;
			d.updateMatrix();
			mesh.setMatrixAt(i, d.matrix);
		};
		l.posts.forEach((p, i) => {
			d.position.set(p.x, (p.h * k) / 2, -p.y);
			d.rotation.set(0, 0, 0);
			d.scale.set(k, p.h * k, k);
			set(m.posts, i);
		});
		l.discs.forEach((p, i) => {
			d.position.set(p.x, (p.h + p.r) * k, -p.y);
			d.rotation.set(Math.PI / 2, 0, 0);
			d.rotateOnWorldAxis(UP, yaw);
			d.scale.set(p.r * k, 0.9 * k, p.r * k);
			set(m.discs, i);
		});
		l.squares.forEach((p, i) => {
			d.position.set(p.x, (p.h + 4.5) * k, -p.y);
			d.rotation.set(0, yaw, 0);
			d.scale.set(9 * k, 9 * k, 0.9 * k);
			set(m.squares, i);
		});
		l.diamonds.forEach((p, i) => {
			d.position.set(p.x, (p.h + 4.5 + p.stacked * 9) * k, -p.y);
			d.rotation.set(0, yaw, Math.PI / 4);
			d.scale.set(6.5 * k, 6.5 * k, 0.9 * k);
			set(m.diamonds, i);
		});
		l.rings.forEach((p, i) => {
			d.position.set(p.x, (p.h + 4.5) * k, -p.y);
			d.rotation.set(0, yaw, 0);
			d.scale.setScalar(k);
			set(m.rings, i);
		});
		for (const mesh of [m.posts, m.discs, m.squares, m.diamonds, m.rings]) {
			if (mesh) mesh.instanceMatrix.needsUpdate = true;
		}
		if (m.beacon) m.beacon.scale.setScalar(k);
		this.#dirty = true;
	}

	/** One dot per counted door, where OpenStreetMap holds the business. */
	#buildDoors(): void {
		if (this.#doors) {
			this.#scene.remove(this.#doors);
			this.#doors.geometry.dispose();
			(this.#doors.material as THREE.Material).dispose();
			this.#doors = null;
			this.#doorColours = null;
		}
		const doors = this.#state.doors;
		if (!doors.length) return;
		if (!this.#dot) this.#dot = makeDotTexture();
		const pos = new Float32Array(doors.length * 3);
		doors.forEach((d, i) => {
			pos[i * 3] = d.x;
			pos[i * 3 + 1] = 4;
			pos[i * 3 + 2] = -d.y;
		});
		this.#doorColours = new Float32Array(doors.length * 3);
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		geo.setAttribute('color', new THREE.BufferAttribute(this.#doorColours, 3));
		// Drawn through whatever stands in front, like a pin on the map. A shop's node
		// sits inside its own footprint more often than not, and a dot at door height
		// inside a five-metre house is a dot under a roof.
		const mat = new THREE.PointsMaterial({
			size: 7,
			sizeAttenuation: false,
			vertexColors: true,
			map: this.#dot,
			alphaTest: 0.4,
			transparent: true,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		});
		this.#doors = new THREE.Points(geo, mat);
		this.#doors.frustumCulled = false;
		this.#scene.add(this.#doors);
		this.#built.doorHour = '';
	}

	/** The doors coloured for the hour and the day: open warm, shut dark. Only the
	    counted whole hour decides it, which is the bar the timetables were read at. */
	#paintDoors(): void {
		const colours = this.#doorColours;
		if (!this.#doors || !colours) return;
		const h = Math.floor(this.#state.hour) % 24;
		const d = this.#state.day;
		const key = `${d}:${h}`;
		if (key === this.#built.doorHour) return;
		this.#built.doorHour = key;
		this.#state.doors.forEach((door, i) => {
			const open = ((door.week[d] ?? 0) >> h) & 1;
			const c = open ? DOOR_OPEN : DOOR_SHUT;
			colours[i * 3] = c.r;
			colours[i * 3 + 1] = c.g;
			colours[i * 3 + 2] = c.b;
		});
		(this.#doors.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
	}

	#dispose(group: THREE.Group): void {
		for (const child of [...group.children]) {
			child.traverse((o) => {
				const mesh = o as THREE.Mesh;
				if (mesh.geometry) mesh.geometry.dispose();
				const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
				// The two shared materials outlive any one build.
				if (mat === this.#groundMat || mat === this.#lineMat) return;
				if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
				else if (mat) mat.dispose();
			});
			group.remove(child);
		}
	}

	/* ── state ────────────────────────────────────────────────────────────── */

	applyState(partial: Partial<AreaState>): void {
		this.#state = { ...this.#state, ...partial };
		const s = this.#state;
		const d = daylightAt(s.hour);
		this.#day = d;
		const R = s.radius;

		/* What has to be rebuilt, by identity. The hour changes sixty times a second
		   while the day runs, and none of these may be rebuilt for that. */
		const boundaryMoved = s.boundary !== this.#built.boundary;
		if (R !== this.#built.radius || boundaryMoved) {
			this.#built.radius = R;
			this.#built.boundary = s.boundary;
			this.#buildBase();
		}
		if (s.geometry !== this.#built.geometry) {
			this.#built.geometry = s.geometry;
			this.#buildCity();
		}
		// The camera before the marks, because the marks are sized by its framing.
		this.#updateCamera();
		if (
			s.stops !== (this.#marksOf?.stops ?? null) ||
			s.rivals !== (this.#marksOf?.rivals ?? null) ||
			s.units !== (this.#marksOf?.units ?? null) ||
			s.field !== (this.#marksOf?.field ?? null)
		) {
			this.#marksOf = { stops: s.stops, rivals: s.rivals, units: s.units, field: s.field };
			this.#buildMarks();
		} else {
			this.#placeMarks();
		}
		if (s.doors !== this.#built.doors) {
			this.#built.doors = s.doors;
			this.#buildDoors();
		}

		/* The ground of an unsurveyed cell is hatched, as it is on the map. */
		if (s.nodata && !this.#hatch) {
			this.#hatch = makeHatchTexture();
			this.#hatch.repeat.set((R * 2) / 30, (R * 2) / 30);
		}
		const wantHatch = s.nodata ? this.#hatch : null;
		if (this.#groundMat.map !== wantHatch) {
			this.#groundMat.map = wantHatch;
			this.#groundMat.needsUpdate = true;
		}

		/* The light: arithmetic, from `scene/daylight`, the same sun the schematic had. */
		this.#fog.color.set(d.fogColor);
		// Scaled to the size of the model: the schematic's block was 96 m across and this
		// disc is up to 1,600 m, and fog is a density per metre.
		this.#fog.density = (d.fogDensity * 40) / (R * 2.6);

		this.#sun.color.set(d.sunColor);
		this.#sun.intensity = d.sunIntensity;
		this.#sun.visible = d.sunIntensity > 0.01;
		const r = R * 3;
		this.#sun.position.set(
			Math.cos(d.sunAzimuth) * Math.cos(d.sunElevation) * r,
			Math.max(R * 0.2, Math.sin(d.sunElevation) * r),
			Math.sin(d.sunAzimuth) * Math.cos(d.sunElevation) * r
		);
		this.#sun.target.position.set(0, 0, 0);
		// The shadow map covers what is in frame rather than the whole disc, so that
		// closed in on a block the shadows are drawn at the block's scale rather than at
		// the disc's, where one texel is a metre wide.
		const half = Math.min(R * 1.2, this.#viewWidth * 0.8);
		const sc = this.#sun.shadow.camera;
		sc.left = -half;
		sc.right = half;
		sc.top = half;
		sc.bottom = -half;
		sc.near = 1;
		sc.far = R * 8;
		sc.updateProjectionMatrix();

		this.#hemi.color.set(d.skyTop).lerp(WHITE, 0.68);
		this.#hemi.groundColor.set(d.groundColor).lerp(WHITE, 0.45);
		this.#hemi.intensity = d.ambientIntensity;

		this.#uWindow.value = d.windowLights;
		this.#uGlow.value = 0.25 + 0.55 * d.streetLights;
		if (this.#lamps) {
			const mat = this.#lamps.material as THREE.PointsMaterial;
			mat.opacity = d.streetLights * 0.9;
			this.#lamps.visible = mat.opacity > 0.02;
		}
		// The boundary must always work against its ground: dark over a model lit by
		// midday sun, light over a dark one.
		this.#lineMat.color.set(0x2a2f38).lerp(WHITE, d.streetLights);

		this.#paintDoors();
		this.#dirty = true;
		// A reader who has asked for less motion gets no loop, so nothing would ever
		// redraw and a scrubbed hour would move the light without moving the picture.
		if (this.#reduced) this.renderOnce();
	}

	#marksOf: { stops: AreaStop[]; rivals: LocalPoint[]; units: LocalPoint[]; field: AreaFieldMark[] } | null =
		null;

	/** Which way the camera stands, so the marks can turn to face it. The track turns
	    it a little as it closes in, and the reader turns it as far as they like. */
	#cameraYaw(): number {
		const t = Math.max(0, Math.min(1, this.#state.cameraT));
		const e = t * t * (3 - 2 * t);
		return 0.42 - e * 0.12 + this.#state.spin;
	}

	#updateCamera(): void {
		const t = Math.max(0, Math.min(1, this.#state.cameraT));
		const e = t * t * (3 - 2 * t);
		const R = this.#state.radius;

		// Above and to the south-east, so north is up as it is on the map, until the
		// reader turns it: the sun stays where it is in the world, so turning the model
		// turns the light on it the way turning a real one would.
		const azim = this.#cameraYaw();
		const elev = 0.64 - e * 0.1;
		// On an orthographic camera distance does not change scale, but fog is
		// computed from it and the near plane has to clear the tallest tower.
		const dist = R * 2.6;
		this.#camera.position.set(
			Math.sin(azim) * Math.cos(elev) * dist,
			Math.sin(elev) * dist,
			Math.cos(azim) * Math.cos(elev) * dist
		);
		this.#camera.lookAt(0, 0, 0);
		this.#camera.near = 1;
		this.#camera.far = dist + R * 3;

		// "Zoom" on an orthographic camera is the frustum width. Opened wide the whole
		// disc fits, its edge is visible and the eye reads an object on a table. Closed
		// in, the block around the point fills the frame and a house is a house, which
		// is what the reader came in to see and what the card at 340 px needs to show
		// anything at all.
		this.#viewWidth = R * (2.35 - e * 1.8);
		this.#applyFrustum();
	}

	#applyFrustum(): void {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		const aspect = w / h;
		let halfW = this.#viewWidth / 2;
		let halfH = halfW / aspect;
		// On a portrait screen a fixed width gives a huge vertical span and the model
		// shrinks to a strip. The vertical span is capped, and narrow screens close in.
		const maxHalfH = this.#viewWidth * 0.62;
		if (halfH > maxHalfH) {
			halfH = maxHalfH;
			halfW = halfH * aspect;
		}
		this.#camera.left = -halfW;
		this.#camera.right = halfW;
		this.#camera.top = halfH;
		this.#camera.bottom = -halfH;
		this.#camera.updateProjectionMatrix();
		this.#mpp = (halfW * 2) / w;
	}

	get daylight(): DaylightSample {
		return this.#day;
	}

	/* ── lifecycle ────────────────────────────────────────────────────────── */

	resize(): void {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		this.#renderer.setSize(w, h, false);
		this.#applyFrustum();
		// A resize changes how many metres a pixel holds, and the marks are sized by that.
		this.#placeMarks();
		this.#dirty = true;
		this.renderOnce();
	}

	renderOnce(): void {
		this.#renderer.render(this.#scene, this.#camera);
		this.#dirty = false;
	}

	/** Not an animation: the loop waits for the state to change and draws then. */
	start(): void {
		if (this.#running) return;
		if (this.#reduced) {
			this.renderOnce();
			return;
		}
		this.#running = true;
		// One frame immediately: a canvas that has been off screen can be cleared by
		// the compositor, and a scene whose state has not changed would never fill it.
		this.renderOnce();
		const loop = () => {
			this.#raf = requestAnimationFrame(loop);
			if (this.#dirty) this.renderOnce();
		};
		this.#raf = requestAnimationFrame(loop);
	}

	stop(): void {
		this.#running = false;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	dispose(): void {
		this.stop();
		this.#hatch?.dispose();
		this.#dot?.dispose();
		this.#scene.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (mesh.geometry) mesh.geometry.dispose();
			const mat = mesh.material;
			if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
			else if (mat) (mat as THREE.Material).dispose();
		});
		this.#renderer.dispose();
	}
}
