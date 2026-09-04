/**
 * An isometric model of a single block around a transit stop — the cafe as its
 * subject.
 *
 * Three formal decisions bind this whole file:
 *
 * 1. **Isometric.** An orthographic camera, seen from above and to the side. What
 *    is on offer is the relationship between the objects (cafe ↔ stop ↔ empty lot),
 *    and an orthographic projection shows that relationship without perspective
 *    distortion.
 * 2. **All white.** No saturated colour. Values are separated as thinly as
 *    possible, and every colour comes from the light of the selected hour.
 * 3. **People are frozen.** No idle animation. Each figure is sculpted in a single
 *    pose — some mid-stride, some seated, some queuing — and the only thing that
 *    moves is what the scroll moves. Hence no rAF spinning for nothing: a frame is
 *    drawn only when the state actually changes.
 *
 * TWO SCENES, ONE FILE
 *
 * The landing page and the app want different things from this model, and the
 * difference is not decoration.
 *
 * The landing page's is a STORY. One cafe, one stop, one empty lot beside it, and
 * the whole of rule 2 in force: it is showing what the product is about, and a
 * saturated colour anywhere in it would be pointing at something that is not the
 * point. `variant: 'story'`, which is the default, so nothing there had to change.
 *
 * The app's is an INSTRUMENT. It stands for one real catchment, it is opened from a
 * panel full of that catchment's figures, and a reader who steps inside it is asking
 * what is actually here. So `variant: 'catchment'` relaxes rule 2 exactly as far as
 * it takes to encode the data and no further: the masses stay white, and a small
 * fixed set of colours identifies the things the panel names. Transit wears the
 * mode's own colour off the map, competitors wear the competitors' red, and the
 * lots up for rent stay the lots up for rent. Everything else is still the hour's.
 *
 * It also draws what the cell actually has rather than a fixed street. A catchment
 * with no TransJakarta stop has no platform and no bus. One with a rail station has
 * an entrance on the pavement in that line's colour. The counts are capped, because
 * thirty shelters in one block is not a model of anything, and the panel beside it
 * carries the real figure.
 */

import * as THREE from 'three';
import type { CategoryKey } from '$lib/types';
import { daylightAt, type DaylightSample } from './daylight';

/** Transit nodes within walking range, by mode, exactly as the grid counts them. */
export interface SceneTransit {
	mrt: number;
	krl: number;
	lrt: number;
	brt: number;
}

/** Which of the two scenes this is. See the note at the top of the file. */
export type SceneVariant = 'story' | 'catchment';

export interface StreetState {
	/** 0..24 */
	hour: number;
	/** 0..1 — busyness, the normalised `hourly[]` profile. */
	density: number;
	category: CategoryKey;
	/** 0..1 — position along the camera track. */
	cameraT: number;
	/** A hex with no data: the block is emptied and the lot is marked. */
	nodata: boolean;
	/** Competitors of the same kind in this area — read as signed outlets on the block. */
	rivals: number;
	/** Commercial space currently up for rent — read as an outlined lot. */
	vacancies: number;
	variant: SceneVariant;
	/**
	 * What this catchment reaches, drawn as the stops themselves.
	 *
	 * Only read in the catchment variant. The story keeps its one stop whatever is
	 * passed, because the landing page is not standing for any particular place and a
	 * block with no bus in it would be a claim about a cell nobody picked.
	 */
	transit: SceneTransit;
}

const NO_TRANSIT: SceneTransit = { mrt: 0, krl: 0, lrt: 0, brt: 0 };

const DEFAULT_STATE: StreetState = {
	hour: 12,
	density: 0.5,
	category: 'kopi',
	cameraT: 0,
	nodata: false,
	rivals: 0,
	vacancies: 1,
	variant: 'story',
	transit: NO_TRANSIT
};

const WHITE = new THREE.Color(0xffffff);
const LAMP_ON = new THREE.Color(0xffdcb0);

/**
 * The only saturated colours in the catchment variant, and they are the map's own.
 *
 * A reader arrives here from a panel where the MRT is orange and TransJakarta is
 * pink, and from a map drawing the routes in those same colours. Picking new ones
 * for the model would mean learning the legend twice.
 *
 * They are worn by small parts — a band, a canopy, a sign — and never by a mass. A
 * whole building in route orange would read as a claim that the building is the
 * station.
 */
const MODE_COLOUR: Record<keyof SceneTransit, number> = {
	mrt: 0xef8f3c,
	krl: 0xe05a5a,
	lrt: 0x46b077,
	brt: 0xc76bbe
};
/** Competitors, in the red they are drawn in on the map and counted in on the card. */
const RIVAL_COLOUR = 0xd1352b;
/** The rail modes, in the order an entrance is given to them: the heaviest line first. */
const RAIL_MODES: Array<keyof SceneTransit> = ['mrt', 'krl', 'lrt'];

/** A very faint tint per business type — enough to tell them apart, not to shout. */
const CATEGORY_TINT: Record<CategoryKey, number> = {
	kopi: 0xd8c3aa,
	minuman: 0xd9c6d2,
	roti: 0xe2cfae,
	warteg: 0xbfd2c2,
	cepatsaji: 0xe3c4b6,
	mie: 0xd6cdb0,
	seafood: 0xb6cdd6,
	restoasing: 0xcbc3d8,
	minimarket: 0xe0c2ba,
	kelontong: 0xd3cbb4,
	laundry: 0xc2d1dc,
	bengkel: 0xc6c8cf,
	apotek: 0xbdd6c9
};

/* The block's plan, in metres. The road runs along the Z axis. */
const BASE = 96;
const ROAD_HALF = 9;
const WALK_HALF = 13.5;
/** Pavement height. Furniture and people stand on it, not on the asphalt. */
const WALK_Y = 0.18;
const STOP_Z = 0;
const STOP_LEN = 17;
const STOP_HALF = 2.6;
/** Platform height. Those waiting stand ON TOP of this figure, not on the ground. */
const STOP_Y = 1.0;
/* A TransJakarta stop sits on the median and its buses pull up alongside it, not
   through it. Two lanes flank the platform — exactly like a real corridor. */
const BUS_LANE_W = 3.5;
const BUS_LANE_X = STOP_HALF + BUS_LANE_W / 2;
const CAFE_X = 19;
const CAFE_Z = -9;
const CAFE_W = 11;
const CAFE_D = 13;

/* The rental lot abuts the cafe: wall to wall. Set apart, the eye has to guess at
   the relationship between them; side by side, the comparison reads immediately.
   Its width matches the cafe's so the two objects really are comparable. */
const LOT_X = CAFE_X;
const LOT_PAD_W = CAFE_W;
const LOT_PAD_D = 9.6;
const LOT_GAP = 1.3;
/* Three slots in a row. How many are shown is decided by the data, not by
   composition: zero space for rent has to genuinely look like zero. Their centres
   are computed, not written by hand — hand-written figures once had the second and
   third lots overlapping their neighbours. */
const LOT_SLOTS = [0, 1, 2, 3].map(
	(i) => CAFE_Z + CAFE_D / 2 + LOT_GAP + LOT_PAD_D / 2 + i * (LOT_PAD_D + LOT_GAP)
);

/* The strip reserved for the story's subject on the right-hand side: the cafe, then
   the run of rental lots. No building mass may enter it. This is what used to leak —
   the guard only covered the first lot and only tested a block's centre point, so
   neighbouring buildings grew straight through the very lot that had to read empty. */
const SUBJECT_Z0 = CAFE_Z - CAFE_D / 2 - 1.8;
const SUBJECT_Z1 = LOT_SLOTS[LOT_SLOTS.length - 1] + LOT_PAD_D / 2 + 1.8;

/**
 * How many of each thing the block can hold before the model stops being one.
 *
 * These are ceilings on the DRAWING, not on the data. A catchment with thirty
 * TransJakarta stops in walking range really has thirty, and the panel beside this
 * says so; thirty shelters in one block would be a picture of a bus depot. The scene
 * carries the label that says it is schematic for exactly this reason.
 */
const MAX_RIVALS = 24;
/** Rail entrances on the pavement, one per rail node. */
const MAX_ENTRANCES = 5;
/** TransJakarta shelters down the median, beyond the platform itself. */
const MAX_SHELTERS = 5;

const MAX_WALKERS = 96;
const MAX_SEATED = 16;
const MAX_CAFE_STAND = 18;
const MAX_STOP = 24;
const MAX_PEOPLE = MAX_WALKERS + MAX_SEATED + MAX_CAFE_STAND + MAX_STOP;

type Pose = 'walk' | 'stand' | 'sit';

interface Person {
	x: number;
	z: number;
	yaw: number;
	/** The frozen phase of a stride — not time, just a fixed leg angle. */
	stride: number;
	height: number;
	pose: Pose;
	/** The floor height they stand on — the stop's platform is not the pavement's height. */
	base: number;
	/** Their group, so each group can be scaled by busyness on its own. */
	group: 'walk' | 'seat' | 'cafe' | 'stop';
}

/**
 * A 45° diagonal hatch, drawn once then tiled. Its period divides the canvas side
 * exactly, so the seams between tiles are invisible.
 */
function makeHatchTexture(): THREE.CanvasTexture {
	const S = 64;
	const c = document.createElement('canvas');
	c.width = S;
	c.height = S;
	const g = c.getContext('2d');
	if (g) {
		g.strokeStyle = '#ffffff';
		g.lineWidth = 3.5;
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
	t.repeat.set(2.6, 2.2);
	return t;
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

export class StreetWorld {
	#renderer: THREE.WebGLRenderer;
	#scene = new THREE.Scene();
	#camera: THREE.OrthographicCamera;
	#canvas: HTMLCanvasElement;

	#sun = new THREE.DirectionalLight(0xffffff, 1);
	#hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
	#fog = new THREE.FogExp2(0xdfe3e6, 0.004);

	#torso!: THREE.InstancedMesh;
	#head!: THREE.InstancedMesh;
	#legs!: THREE.InstancedMesh;
	#arms!: THREE.InstancedMesh;
	#windows!: THREE.InstancedMesh;
	#shopfronts!: THREE.InstancedMesh;
	#lamps!: THREE.InstancedMesh;

	#people: Person[] = [];
	#windowSeeds: number[] = [];
	#lotGroup = new THREE.Group();
	#lotSlots: THREE.Group[] = [];
	#rivalMarks!: THREE.InstancedMesh;
	#bus = new THREE.Group();
	/** The TransJakarta platform. Hidden in a catchment with no corridor in range. */
	#stopGroup = new THREE.Group();
	/** One rail entrance per rail node, wearing its line's colour on the canopy and
	    on the totem beside it. */
	#entrances: Array<{
		group: THREE.Group;
		canopy: THREE.MeshStandardMaterial;
		sign: THREE.MeshStandardMaterial;
	}> = [];
	/** Shelters down the median, one per TransJakarta node past the platform itself. */
	#shelters: THREE.Group[] = [];
	/** The band along the platform roof, which carries TransJakarta's colour. */
	#stopBand!: THREE.MeshStandardMaterial;
	#proposedMat!: THREE.MeshStandardMaterial;
	/** The rental lot's lines and hatching — colour set against the ground each hour. */
	#lotLineMats: Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial> = [];
	#hatchTex: THREE.CanvasTexture | null = null;
	/** Building faces a competitor's sign is allowed to attach to. */
	#signSpots: { x: number; z: number; len: number }[] = [];

	#state: StreetState = { ...DEFAULT_STATE };
	#day: DaylightSample = daylightAt(12);
	#raf = 0;
	#running = false;
	#reduced: boolean;
	#lastPaintKey = '';
	/** How many of the front-row shopfronts are competitors, for `#paintLights`. */
	#rivalFronts = 0;
	#lastCrowdKey = '';
	/** A frame is drawn only while this is true. A frozen scene does not need 60 fps. */
	#dirty = true;
	#shadowSize = 2048;

	#dummy = new THREE.Object3D();
	#color = new THREE.Color();

	constructor(canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean } = {}) {
		this.#canvas = canvas;
		this.#reduced = opts.reducedMotion ?? false;

		this.#renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance',
			alpha: true
		});
		// Its users are on mid-range Android phones with limited data — full pixel and
		// shadow-map resolution on a small screen burns battery for no visible gain.
		const small = window.innerWidth < 768;
		this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
		this.#renderer.setClearAlpha(0);
		this.#renderer.shadowMap.enabled = true;
		this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.#shadowSize = small ? 1024 : 2048;
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.#renderer.toneMappingExposure = 1.0;

		// The sky is a CSS gradient behind the canvas, not a dome inside the scene: in
		// an orthographic projection every ray is parallel, so a sky dome would just
		// produce one flat colour. The fog is set to the horizon colour so distant
		// geometry dissolves into exactly that same sky.
		this.#scene.fog = this.#fog;

		this.#camera = new THREE.OrthographicCamera(-40, 40, 30, -30, -200, 400);

		this.#buildLights();
		this.#buildBase();
		this.#buildRoad();
		this.#buildStop();
		this.#buildBus();
		this.#buildTransit();
		this.#buildBlocks();
		this.#buildCafe();
		this.#buildLot();
		this.#buildCrowd();

		this.applyState({});
		this.resize();
	}

	/* ── light ────────────────────────────────────────────────────────────── */

	#buildLights() {
		this.#sun.castShadow = true;
		this.#sun.shadow.mapSize.set(this.#shadowSize, this.#shadowSize);
		const s = this.#sun.shadow.camera;
		s.left = -70;
		s.right = 70;
		s.top = 70;
		s.bottom = -70;
		s.near = 1;
		s.far = 320;
		this.#sun.shadow.bias = -0.0006;
		this.#sun.shadow.normalBias = 0.02;
		this.#scene.add(this.#sun, this.#sun.target, this.#hemi);
	}

	/* ── model base ───────────────────────────────────────────────────────── */

	#buildBase() {
		// A base slab with visible thickness — this is what tells the eye it is looking
		// at an object on a table, not a real city photographed from a helicopter.
		const slab = new THREE.Mesh(
			new THREE.BoxGeometry(BASE, 2.2, BASE),
			new THREE.MeshStandardMaterial({ color: 0xdcd8d1, roughness: 0.95 })
		);
		slab.position.y = -1.1;
		slab.receiveShadow = true;
		this.#scene.add(slab);

		const top = new THREE.Mesh(
			new THREE.PlaneGeometry(BASE, BASE),
			new THREE.MeshStandardMaterial({ color: 0xd6d2cb, roughness: 0.96 })
		);
		top.rotation.x = -Math.PI / 2;
		top.position.y = 0.002;
		top.receiveShadow = true;
		this.#scene.add(top);
	}

	#buildRoad() {
		const road = new THREE.Mesh(
			new THREE.PlaneGeometry(ROAD_HALF * 2, BASE),
			new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.9 })
		);
		road.rotation.x = -Math.PI / 2;
		road.position.y = 0.02;
		road.receiveShadow = true;
		this.#scene.add(road);

		// Busway lanes flank the median — TransJakarta uses separate lanes down the middle.
		const laneMat = new THREE.MeshStandardMaterial({ color: 0xc6c2bb, roughness: 0.9 });
		for (const side of [-1, 1] as const) {
			const lane = new THREE.Mesh(new THREE.BoxGeometry(BUS_LANE_W, 0.1, BASE), laneMat);
			lane.position.set(side * BUS_LANE_X, 0.06, 0);
			lane.receiveShadow = true;
			this.#scene.add(lane);
		}

		for (const side of [-1, 1] as const) {
			const walk = new THREE.Mesh(
				new THREE.BoxGeometry(WALK_HALF - ROAD_HALF, 0.18, BASE),
				new THREE.MeshStandardMaterial({ color: 0xd2cec7, roughness: 0.93 })
			);
			walk.position.set(side * (ROAD_HALF + (WALK_HALF - ROAD_HALF) / 2), 0.09, 0);
			walk.receiveShadow = true;
			walk.castShadow = true;
			this.#scene.add(walk);
		}

		// lamp posts
		const poles = new THREE.InstancedMesh(
			new THREE.CylinderGeometry(0.09, 0.11, 6.2, 6),
			new THREE.MeshStandardMaterial({ color: 0xcbc8c2, roughness: 0.72 }),
			12
		);
		this.#lamps = new THREE.InstancedMesh(
			new THREE.SphereGeometry(0.3, 8, 6),
			new THREE.MeshBasicMaterial({ color: 0x93908a }),
			12
		);
		let i = 0;
		for (let k = 0; k < 6; k++) {
			for (const side of [-1, 1] as const) {
				const z = -40 + k * 16;
				const x = side * (WALK_HALF - 0.8);
				this.#place(x, 3.1, z);
				poles.setMatrixAt(i, this.#dummy.matrix);
				this.#place(x, 6.3, z);
				this.#lamps.setMatrixAt(i, this.#dummy.matrix);
				i++;
			}
		}
		poles.castShadow = true;
		this.#scene.add(poles, this.#lamps);
	}

	#place(x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1) {
		this.#dummy.position.set(x, y, z);
		this.#dummy.rotation.set(0, yaw, 0);
		this.#dummy.scale.set(sx, sy, sz);
		this.#dummy.updateMatrix();
	}

	/* ── TransJakarta stop ────────────────────────────────────────────────── */

	#buildStop() {
		const g = this.#stopGroup;
		const shell = new THREE.MeshStandardMaterial({ color: 0xe6e3dd, roughness: 0.8 });

		const platform = new THREE.Mesh(
			new THREE.BoxGeometry(STOP_HALF * 2, STOP_Y, STOP_LEN),
			shell
		);
		platform.position.set(0, STOP_Y / 2, STOP_Z);
		platform.castShadow = true;
		platform.receiveShadow = true;
		g.add(platform);

		const roof = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.28, STOP_LEN + 1.4), shell);
		roof.position.set(0, 3.9, STOP_Z);
		roof.castShadow = true;
		g.add(roof);

		// half-height glass walls
		const glass = new THREE.MeshStandardMaterial({
			color: 0xd4d9dd,
			roughness: 0.25,
			metalness: 0.05,
			transparent: true,
			opacity: 0.55
		});
		for (const side of [-1, 1] as const) {
			const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, STOP_LEN - 1.5), glass);
			wall.position.set(side * 2.55, 2.0, STOP_Z);
			g.add(wall);
		}

		const posts = new THREE.InstancedMesh(
			new THREE.BoxGeometry(0.16, 3.0, 0.16),
			shell,
			8
		);
		let i = 0;
		for (let k = 0; k < 4; k++) {
			for (const side of [-1, 1] as const) {
				this.#place(side * 2.5, 2.4, STOP_Z - 6.4 + k * 4.3);
				posts.setMatrixAt(i++, this.#dummy.matrix);
			}
		}
		posts.castShadow = true;
		g.add(posts);

		// The band along the roof, in TransJakarta's own colour on the map. White in the
		// story, where nothing is standing for a particular corridor.
		const band = new THREE.Mesh(
			new THREE.BoxGeometry(6.1, 0.34, STOP_LEN + 1.5),
			new THREE.MeshStandardMaterial({ color: 0xe6e3dd, roughness: 0.7 })
		);
		band.position.set(0, 3.6, STOP_Z);
		g.add(band);
		this.#stopBand = band.material as THREE.MeshStandardMaterial;

		this.#scene.add(g);
	}

	/* ── what this catchment reaches ──────────────────────────────────────── */

	/**
	 * The stops themselves, one object per counted node.
	 *
	 * Built once at full count and revealed by the data, the way the rental lots are:
	 * a catchment's transit does not change while it is on screen, and rebuilding
	 * geometry on every selection is how a panel starts dropping frames.
	 *
	 * Rail gets an ENTRANCE and not a station. A station in walking range is usually
	 * not on this street, and drawing the platform would put a line through a block
	 * that has no line through it. A stair box with a canopy is what the walk to it
	 * actually ends at, and it is small enough to stand on a pavement without
	 * pretending to be the infrastructure behind it.
	 */
	#buildTransit() {
		const shell = new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.8 });
		const dark = new THREE.MeshStandardMaterial({ color: 0x8f8d88, roughness: 0.9 });

		// Rail entrances, down the pavement opposite the cafe so they never fight it for
		// the eye. Spread wide enough apart to be counted rather than read as one row.
		for (let i = 0; i < MAX_ENTRANCES; i++) {
			const g = new THREE.Group();
			const z = -34 + i * 17;

			const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 4.6), shell);
			box.position.set(0, 1.3 + WALK_Y, 0);
			box.castShadow = true;
			box.receiveShadow = true;
			g.add(box);

			// The mouth of the stairs: a dark face, so the box reads as a way down rather
			// than as one more small building.
			const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 3.1), dark);
			mouth.position.set(-1.74, 0.95 + WALK_Y, 0);
			g.add(mouth);

			// Two strengths of the same colour. The canopy is a roof and takes it washed
			// half into white, because a fully saturated slab that size stops being a
			// canopy and becomes the brightest object in the model. The totem beside it
			// takes it neat: it is small, and it is the thing you actually pick a station
			// out by from across a road.
			const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 });
			const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 5.4), canopyMat);
			canopy.position.set(-0.3, 2.85 + WALK_Y, 0);
			canopy.castShadow = true;
			g.add(canopy);

			const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), shell);
			post.position.set(-2.4, 2.1 + WALK_Y, 2.6);
			post.castShadow = true;
			g.add(post);
			const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
			const sign = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 1.15), signMat);
			sign.position.set(-2.4, 3.7 + WALK_Y, 2.6);
			g.add(sign);

			g.position.set(-(WALK_HALF - 2.6), 0, z);
			g.visible = false;
			this.#scene.add(g);
			this.#entrances.push({ group: g, canopy: canopyMat, sign: signMat });
		}

		// TransJakarta shelters, on the median past the platform. The platform itself is
		// the first node; these are the rest of them.
		for (let i = 0; i < MAX_SHELTERS; i++) {
			const g = new THREE.Group();
			const side = i % 2 === 0 ? 1 : -1;
			const z = side * (STOP_LEN / 2 + 8 + Math.floor(i / 2) * 11);

			const island = new THREE.Mesh(new THREE.BoxGeometry(STOP_HALF * 2, 0.42, 6.4), shell);
			island.position.set(0, 0.21, 0);
			island.receiveShadow = true;
			g.add(island);

			const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 6.0), shell);
			roof.position.set(0, 2.9, 0);
			roof.castShadow = true;
			g.add(roof);

			const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), shell, 4);
			let k = 0;
			for (const sx of [-1, 1] as const) {
				for (const sz of [-1, 1] as const) {
					this.#place(sx * 1.5, 1.5, sz * 2.6);
					legs.setMatrixAt(k++, this.#dummy.matrix);
				}
			}
			legs.castShadow = true;
			g.add(legs);

			const band = new THREE.Mesh(
				new THREE.BoxGeometry(3.5, 0.26, 6.1),
				new THREE.MeshStandardMaterial({ color: MODE_COLOUR.brt, roughness: 0.65 })
			);
			band.position.set(0, 2.68, 0);
			g.add(band);

			g.position.set(0, 0, z);
			g.visible = false;
			this.#scene.add(g);
			this.#shelters.push(g);
		}
	}

	/* ── TransJakarta bus (articulated) ───────────────────────────────────── */

	#buildBus() {
		const body = new THREE.MeshStandardMaterial({ color: 0xf0eee9, roughness: 0.55 });
		const glass = new THREE.MeshStandardMaterial({
			color: 0x9fa6ad,
			roughness: 0.2,
			metalness: 0.1
		});
		const tyre = new THREE.MeshStandardMaterial({ color: 0xa7a49e, roughness: 0.9 });

		// two segments + a concertina joint: the distinctive articulated-bus silhouette
		const seg = (len: number, z: number) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.5, len), body);
			m.position.set(0, 1.85, z);
			m.castShadow = true;
			this.#bus.add(m);
			const band = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.95, len - 0.8), glass);
			band.position.set(0, 2.35, z);
			this.#bus.add(band);
		};
		seg(8.2, 4.6);
		seg(7.4, -4.4);

		// The concertina joint. Made dark and thin, the two segments read as two buses
		// travelling nose to tail — so it is only slightly narrower than the body, in the
		// same colour, and long enough to fully close the gap between segments.
		const joint = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.3, 1.9), body);
		joint.position.set(0, 1.85, 0.2);
		joint.castShadow = true;
		this.#bus.add(joint);

		const wheels = new THREE.InstancedMesh(
			new THREE.CylinderGeometry(0.52, 0.52, 0.34, 12),
			tyre,
			6
		);
		let i = 0;
		for (const z of [7.4, 1.6, -6.6]) {
			for (const side of [-1, 1] as const) {
				this.#dummy.position.set(side * 1.2, 0.52, z);
				this.#dummy.rotation.set(0, 0, Math.PI / 2);
				this.#dummy.scale.setScalar(1);
				this.#dummy.updateMatrix();
				wheels.setMatrixAt(i++, this.#dummy.matrix);
			}
		}
		wheels.castShadow = true;
		this.#bus.add(wheels);

		// Pulls up in the lane beside the platform, not through it.
		this.#bus.position.set(-BUS_LANE_X, 0.1, 0);
		this.#scene.add(this.#bus);
	}

	/* ── surrounding building blocks ──────────────────────────────────────── */

	#buildBlocks() {
		const rnd = mulberry32(20260212);
		const boxes: {
			x: number;
			z: number;
			w: number;
			d: number;
			h: number;
			side: 1 | -1;
			front: boolean;
		}[] = [];

		// Two rows per side. The back row is not decoration: without it the strip cleared
		// for the rental lots gapes all the way to the slab's edge and this block reads as
		// a city that has run out, rather than as one empty lot.
		const ROWS = [
			{ front: true, x0: WALK_HALF, depth: [11, 9] },
			{ front: false, x0: WALK_HALF + 22.5, depth: [8, 4] }
		] as const;

		for (const side of [-1, 1] as const) {
			for (const row of ROWS) {
				let z = -46;
				while (z < 46) {
					const w = 8 + rnd() * 8;
					const d = row.depth[0] + rnd() * row.depth[1];
					const base = side === 1 ? 5.5 : 4;
					const h = (row.front ? base : base + 1.5) + rnd() * (side === 1 ? 9 : 4);
					const cz = z + w / 2;
					// Tested by its extent, not its centre point: a 16 m wide block whose
					// centre falls outside the strip can still push halfway into it.
					const intrudes =
						side === 1 && row.front && cz + w / 2 > SUBJECT_Z0 && cz - w / 2 < SUBJECT_Z1;
					if (!intrudes) {
						boxes.push({
							x: side * (row.x0 + d / 2),
							z: cz,
							w,
							d,
							h,
							side,
							front: row.front
						});
					}
					z += w + 1.4 + rnd() * 1.4;
				}
			}
		}

		// Competitor signs are mounted on building faces that actually exist rather than
		// on predetermined points — a sign floating in the gap between buildings would
		// read as a drawing error. Nearest the stop comes first: even a single competitor
		// has to land somewhere visible.
		this.#signSpots = boxes
			.filter((b) => b.front)
			.map((b) => ({
				x: b.x - b.side * (b.d / 2 + 0.06),
				z: b.z,
				// a sign must not be longer than the face it sits on
				len: Math.min(1, (b.w * 0.62) / 3.2)
			}))
			.sort((a, b) => Math.abs(a.z) - Math.abs(b.z))
			.slice(0, MAX_RIVALS);

		const mass = new THREE.InstancedMesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.02 }),
			boxes.length
		);
		mass.castShadow = true;
		mass.receiveShadow = true;
		boxes.forEach((b, i) => {
			this.#place(b.x, b.h / 2, b.z, 0, b.d, b.h, b.w);
			mass.setMatrixAt(i, this.#dummy.matrix);
			const g = 0.84 + rnd() * 0.12;
			this.#color.setRGB(g, g * 0.992, g * 0.976);
			mass.setColorAt(i, this.#color);
		});
		this.#scene.add(mass);

		// windows: small planes on the face that looks onto the street
		const cells: { x: number; y: number; z: number; side: 1 | -1 }[] = [];
		for (const b of boxes) {
			const floors = Math.max(1, Math.floor((b.h - 3.6) / 3.1));
			const bays = Math.max(1, Math.floor(b.w / 2.8));
			for (let f = 0; f < floors; f++) {
				for (let k = 0; k < bays; k++) {
					cells.push({
						x: b.x - b.side * (b.d / 2 + 0.06),
						y: 4.3 + f * 3.1,
						z: b.z - b.w / 2 + 1.4 + k * (b.w / bays),
						side: b.side
					});
				}
			}
		}
		this.#windows = new THREE.InstancedMesh(
			new THREE.PlaneGeometry(1.5, 1.5),
			new THREE.MeshBasicMaterial({ toneMapped: false }),
			cells.length
		);
		cells.forEach((c, i) => {
			this.#place(c.x, c.y, c.z, c.side === 1 ? -Math.PI / 2 : Math.PI / 2);
			this.#windows.setMatrixAt(i, this.#dummy.matrix);
			this.#windowSeeds.push(rnd());
		});
		this.#scene.add(this.#windows);

		// Ground-floor shopfronts — front row only. A shopfront on a building standing
		// behind another block faces nobody.
		//
		// Ordered nearest the stop first, and it matters: in a catchment the first few of
		// these are painted as the competitors already trading here, and they have to be
		// the ones a reader can actually see. `#signSpots` above is sorted the same way,
		// so the Nth board and the Nth red frontage land on the SAME building and one
		// competitor reads as one shop rather than as two marks.
		const fronts = boxes.filter((b) => b.front).sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
		this.#shopfronts = new THREE.InstancedMesh(
			new THREE.BoxGeometry(0.26, 2.4, 1),
			new THREE.MeshBasicMaterial({ toneMapped: false }),
			fronts.length
		);
		fronts.forEach((b, i) => {
			this.#place(b.x - b.side * (b.d / 2 + 0.04), 1.5, b.z, 0, 1, 1, b.w * 0.7);
			this.#shopfronts.setMatrixAt(i, this.#dummy.matrix);
			this.#windowSeeds.push(rnd());
		});
		this.#scene.add(this.#shopfronts);
	}

	/* ── the cafe: the scene's subject ────────────────────────────────────── */

	#buildCafe() {
		const g = new THREE.Group();
		const shell = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.82 });
		const trim = new THREE.MeshStandardMaterial({ color: 0xdedbd5, roughness: 0.8 });
		const glass = new THREE.MeshStandardMaterial({
			color: 0xb9c0c6,
			roughness: 0.18,
			metalness: 0.08
		});

		const body = new THREE.Mesh(new THREE.BoxGeometry(CAFE_W, 7.2, CAFE_D), shell);
		body.position.set(CAFE_X, 3.6, CAFE_Z);
		body.castShadow = true;
		body.receiveShadow = true;
		g.add(body);

		// the glass frontage facing the pavement
		const front = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.1, 11.4), glass);
		front.position.set(CAFE_X - 5.55, 1.9, CAFE_Z);
		g.add(front);

		// the awning
		const awn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 12), trim);
		awn.position.set(CAFE_X - 6.7, 3.55, CAFE_Z);
		awn.rotation.z = 0.1;
		awn.castShadow = true;
		g.add(awn);

		// tables and chairs on the pavement — this is the "cafe busyness" the eye reads
		const tableTop = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12);
		const tableLeg = new THREE.CylinderGeometry(0.06, 0.09, 0.72, 8);
		const chair = new THREE.BoxGeometry(0.44, 0.09, 0.44);
		const parasol = new THREE.ConeGeometry(1.5, 0.5, 12);

		const tops = new THREE.InstancedMesh(tableTop, trim, 4);
		const legs = new THREE.InstancedMesh(tableLeg, trim, 4);
		const chairs = new THREE.InstancedMesh(chair, trim, 16);
		const shades = new THREE.InstancedMesh(parasol, shell, 4);
		const poles = new THREE.InstancedMesh(tableLeg, trim, 4);

		let ci = 0;
		for (let t = 0; t < 4; t++) {
			const tz = CAFE_Z - 4.6 + t * 3.1;
			const tx = CAFE_X - 8.2;
			this.#place(tx, WALK_Y + 0.94, tz);
			tops.setMatrixAt(t, this.#dummy.matrix);
			this.#place(tx, WALK_Y + 0.54, tz);
			legs.setMatrixAt(t, this.#dummy.matrix);
			this.#place(tx, WALK_Y + 2.9, tz, 0, 1, 1, 1);
			shades.setMatrixAt(t, this.#dummy.matrix);
			this.#place(tx, WALK_Y + 1.9, tz, 0, 1, 2.6, 1);
			poles.setMatrixAt(t, this.#dummy.matrix);
			for (const [dx, dz] of [
				[-1.0, 0],
				[1.0, 0],
				[0, -1.0],
				[0, 1.0]
			]) {
				this.#place(tx + dx, WALK_Y + 0.62, tz + dz);
				chairs.setMatrixAt(ci++, this.#dummy.matrix);
			}
		}
		for (const m of [tops, legs, chairs, shades, poles]) {
			m.castShadow = true;
			g.add(m);
		}

		this.#scene.add(g);
	}

	/* ── the lots available to rent ───────────────────────────────────────── */

	#buildLot() {
		this.#proposedMat = new THREE.MeshStandardMaterial({
			color: 0xd8c3aa,
			transparent: true,
			opacity: 0.26,
			roughness: 0.6,
			emissive: 0x000000,
			// Without this, two consecutive lots erase each other depending on the camera
			// angle — the one behind sometimes shows, sometimes vanishes.
			depthWrite: false
		});
		// In an architect's model, what has not been built is drawn dashed and what has
		// is drawn solid. A rental lot uses both conventions at once: its footprint is
		// real (a solid line on the ground), its mass is only proposed (a dashed line).
		const edgeMat = new THREE.LineDashedMaterial({
			color: 0xffffff,
			dashSize: 0.85,
			gapSize: 0.5,
			transparent: true,
			opacity: 0.92
		});
		const groundMat = new THREE.LineBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.75
		});

		// Diagonal hatching: the standard way to mark an empty lot on a working drawing,
		// and the only cue that still reads once the model goes dark — a translucent white
		// plane on its own disappears the moment the sun goes down.
		const hatch = makeHatchTexture();
		this.#hatchTex = hatch;
		const padMat = new THREE.MeshBasicMaterial({
			map: hatch,
			color: 0xffffff,
			transparent: true,
			opacity: 0.5,
			depthWrite: false,
			toneMapped: false
		});
		this.#lotLineMats = [edgeMat, groundMat, padMat];

		const padGeo = new THREE.PlaneGeometry(LOT_PAD_W, LOT_PAD_D);
		const volGeo = new THREE.BoxGeometry(LOT_PAD_W - 1.6, 6.4, LOT_PAD_D - 1.6);
		const volEdges = new THREE.EdgesGeometry(volGeo);
		const padEdges = new THREE.EdgesGeometry(
			new THREE.BoxGeometry(LOT_PAD_W, 0.02, LOT_PAD_D)
		);

		for (const z of LOT_SLOTS) {
			const slot = new THREE.Group();

			const pad = new THREE.Mesh(padGeo, padMat);
			pad.rotation.x = -Math.PI / 2;
			pad.position.set(LOT_X, 0.05, z);
			slot.add(pad);

			const proposed = new THREE.Mesh(volGeo, this.#proposedMat);
			proposed.position.set(LOT_X, 3.2, z);
			slot.add(proposed);

			const edges = new THREE.LineSegments(volEdges, edgeMat);
			edges.position.copy(proposed.position);
			// Required for dashed lines: without per-segment distances the line draws solid.
			edges.computeLineDistances();
			slot.add(edges);

			const ground = new THREE.LineSegments(padEdges, groundMat);
			ground.position.set(LOT_X, 0.06, z);
			slot.add(ground);

			this.#lotSlots.push(slot);
			this.#lotGroup.add(slot);
		}

		this.#scene.add(this.#lotGroup);

		// Competing outlets of the same kind: small signed boards on the building faces
		// along the street. How many appear follows the competitor count actually on record.
		this.#rivalMarks = new THREE.InstancedMesh(
			new THREE.BoxGeometry(0.25, 1.5, 3.2),
			new THREE.MeshStandardMaterial({ color: 0xd8c3aa, roughness: 0.7 }),
			MAX_RIVALS
		);
		this.#rivalMarks.castShadow = true;
		this.#rivalMarks.count = 0;
		this.#signSpots.forEach((s, i) => {
			this.#place(s.x, 2.4, s.z, 0, 1, 1, s.len);
			this.#rivalMarks.setMatrixAt(i, this.#dummy.matrix);
		});
		this.#scene.add(this.#rivalMarks);
	}

	/* ── figures ──────────────────────────────────────────────────────────── */

	#buildCrowd() {
		const rnd = mulberry32(77712);

		// seated at the cafe tables
		for (let t = 0; t < 4; t++) {
			const tz = CAFE_Z - 4.6 + t * 3.1;
			const tx = CAFE_X - 8.2;
			const seats: [number, number, number][] = [
				[-1.0, 0, Math.PI / 2],
				[1.0, 0, -Math.PI / 2],
				[0, -1.0, 0],
				[0, 1.0, Math.PI]
			];
			for (const [dx, dz, yaw] of seats) {
				this.#people.push({
					x: tx + dx,
					z: tz + dz,
					yaw,
					stride: 0,
					height: 0.94 + rnd() * 0.12,
					pose: 'sit',
					base: WALK_Y,
					group: 'seat'
				});
			}
		}

		// standing & queuing outside the cafe
		for (let i = 0; i < MAX_CAFE_STAND; i++) {
			this.#people.push({
				x: CAFE_X - 6.4 - rnd() * 3.4,
				z: CAFE_Z - 6 + rnd() * 12,
				yaw: rnd() * Math.PI * 2,
				stride: rnd() < 0.4 ? (rnd() - 0.5) * 0.5 : 0,
				height: 0.9 + rnd() * 0.2,
				pose: rnd() < 0.35 ? 'walk' : 'stand',
				base: WALK_Y,
				group: 'cafe'
			});
		}

		// waiting at the stop
		for (let i = 0; i < MAX_STOP; i++) {
			this.#people.push({
				x: (rnd() - 0.5) * 3.6,
				z: STOP_Z - STOP_LEN / 2 + 1 + rnd() * (STOP_LEN - 2),
				yaw: rnd() * Math.PI * 2,
				stride: 0,
				height: 0.9 + rnd() * 0.2,
				pose: 'stand',
				base: STOP_Y,
				group: 'stop'
			});
		}

		// walking the pavement, frozen mid-stride
		for (let i = 0; i < MAX_WALKERS; i++) {
			const side = rnd() < 0.5 ? -1 : 1;
			const inner = rnd() < 0.5;
			this.#people.push({
				x: side * (ROAD_HALF + (inner ? 1.3 : 3.1)) + (rnd() - 0.5) * 1.3,
				z: -46 + rnd() * 92,
				yaw: rnd() < 0.5 ? 0 : Math.PI,
				// each person gets their own leg angle: a row frozen in unison reads as a
				// pattern rather than as a crowd
				stride: (rnd() - 0.5) * 1.5,
				height: 0.9 + rnd() * 0.2,
				pose: 'walk',
				base: WALK_Y,
				group: 'walk'
			});
		}

		const skin = new THREE.MeshStandardMaterial({
			color: 0xf2f0ec,
			roughness: 0.78,
			metalness: 0
		});
		const torsoGeo = new THREE.CapsuleGeometry(0.16, 0.4, 3, 8);
		this.#torso = new THREE.InstancedMesh(torsoGeo, skin, MAX_PEOPLE);
		this.#head = new THREE.InstancedMesh(
			new THREE.SphereGeometry(0.115, 8, 6),
			new THREE.MeshStandardMaterial({ color: 0xeae7e1, roughness: 0.8 }),
			MAX_PEOPLE
		);

		const legGeo = new THREE.BoxGeometry(0.115, 0.5, 0.13);
		legGeo.translate(0, -0.25, 0);
		this.#legs = new THREE.InstancedMesh(
			legGeo,
			new THREE.MeshStandardMaterial({ color: 0xe4e1db, roughness: 0.84 }),
			MAX_PEOPLE * 2
		);
		const armGeo = new THREE.BoxGeometry(0.085, 0.42, 0.095);
		armGeo.translate(0, -0.21, 0);
		this.#arms = new THREE.InstancedMesh(armGeo, skin, MAX_PEOPLE * 2);

		for (const m of [this.#torso, this.#head, this.#legs, this.#arms]) {
			m.castShadow = true;
			m.frustumCulled = false;
			this.#scene.add(m);
		}

		for (let i = 0; i < MAX_PEOPLE; i++) {
			const v = 0.93 + rnd() * 0.07;
			this.#color.setRGB(v, v * 0.995, v * 0.985);
			this.#torso.setColorAt(i, this.#color);
			this.#arms.setColorAt(i * 2, this.#color);
			this.#arms.setColorAt(i * 2 + 1, this.#color);
		}
	}

	/** Re-sculpted only when busyness changes — not every frame. */
	#layoutCrowd() {
		const d = this.#state.nodata ? 0 : Math.max(0, Math.min(1, this.#state.density));
		const key = `${d.toFixed(3)}|${this.#state.nodata}`;
		if (key === this.#lastCrowdKey) return;
		this.#lastCrowdKey = key;

		// each group fills up according to its own share
		const quota: Record<Person['group'], number> = {
			seat: Math.round(MAX_SEATED * d),
			cafe: Math.round(MAX_CAFE_STAND * d),
			stop: Math.round(MAX_STOP * d),
			walk: Math.round(MAX_WALKERS * d)
		};
		const used: Record<Person['group'], number> = { seat: 0, cafe: 0, stop: 0, walk: 0 };
		const hide = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);

		for (let i = 0; i < MAX_PEOPLE; i++) {
			const p = this.#people[i];
			const show = used[p.group] < quota[p.group];
			used[p.group]++;

			if (!show) {
				this.#torso.setMatrixAt(i, hide);
				this.#head.setMatrixAt(i, hide);
				this.#legs.setMatrixAt(i * 2, hide);
				this.#legs.setMatrixAt(i * 2 + 1, hide);
				this.#arms.setMatrixAt(i * 2, hide);
				this.#arms.setMatrixAt(i * 2 + 1, hide);
				continue;
			}

			const s = p.height;
			const seated = p.pose === 'sit';
			const y0 = p.base;
			const hipY = y0 + (seated ? 0.46 : 0.52) * s;
			const torsoY = y0 + (seated ? 0.86 : 0.95) * s;
			const headY = y0 + (seated ? 1.2 : 1.34) * s;
			const swing = p.pose === 'walk' ? p.stride : 0;

			this.#place(p.x, torsoY, p.z, p.yaw);
			this.#torso.setMatrixAt(i, this.#dummy.matrix);
			this.#place(p.x, headY, p.z, p.yaw);
			this.#head.setMatrixAt(i, this.#dummy.matrix);

			for (let k = 0; k < 2; k++) {
				const sign = k === 0 ? 1 : -1;
				const off = 0.085 * s * sign;
				const ox = off * Math.cos(p.yaw);
				const oz = -off * Math.sin(p.yaw);

				this.#dummy.position.set(p.x + ox, hipY, p.z + oz);
				// seated: thigh forward and level; walking: legs opened at a fixed angle
				this.#dummy.rotation.set(seated ? -1.25 : swing * sign, p.yaw, 0);
				this.#dummy.scale.setScalar(s);
				this.#dummy.updateMatrix();
				this.#legs.setMatrixAt(i * 2 + k, this.#dummy.matrix);

				const aoff = 0.21 * s * sign;
				this.#dummy.position.set(
					p.x + aoff * Math.cos(p.yaw),
					y0 + (seated ? 1.04 : 1.16) * s,
					p.z - aoff * Math.sin(p.yaw)
				);
				this.#dummy.rotation.set(seated ? -0.9 : -swing * sign * 0.7, p.yaw, 0);
				this.#dummy.updateMatrix();
				this.#arms.setMatrixAt(i * 2 + k, this.#dummy.matrix);
			}
		}

		this.#torso.instanceMatrix.needsUpdate = true;
		this.#head.instanceMatrix.needsUpdate = true;
		this.#legs.instanceMatrix.needsUpdate = true;
		this.#arms.instanceMatrix.needsUpdate = true;
	}

	/* ── state ────────────────────────────────────────────────────────────── */

	applyState(partial: Partial<StreetState>) {
		this.#state = { ...this.#state, ...partial };
		const d = daylightAt(this.#state.hour);
		this.#day = d;

		this.#fog.color.set(d.fogColor);
		this.#fog.density = d.fogDensity * 0.55;

		this.#sun.color.set(d.sunColor);
		this.#sun.intensity = d.sunIntensity;
		this.#sun.visible = d.sunIntensity > 0.01;
		const r = 150;
		this.#sun.position.set(
			Math.cos(d.sunAzimuth) * Math.cos(d.sunElevation) * r,
			Math.max(6, Math.sin(d.sunElevation) * r),
			Math.sin(d.sunAzimuth) * Math.cos(d.sunElevation) * r
		);
		this.#sun.target.position.set(4, 0, 0);

		this.#hemi.color.set(d.skyTop).lerp(WHITE, 0.68);
		this.#hemi.groundColor.set(d.groundColor).lerp(WHITE, 0.45);
		this.#hemi.intensity = d.ambientIntensity;

		const catchment = this.#state.variant === 'catchment';
		const tint = CATEGORY_TINT[this.#state.category] ?? CATEGORY_TINT.kopi;
		this.#proposedMat.color.setHex(tint);
		this.#proposedMat.emissive.setHex(tint);
		this.#proposedMat.emissiveIntensity = d.windowLights * 0.45;
		// Zero space for rent means zero lots shown — not one sample lot.
		const shown = this.#state.nodata ? 0 : Math.max(0, Math.min(LOT_SLOTS.length, Math.round(this.#state.vacancies)));
		this.#lotSlots.forEach((slot, i) => (slot.visible = i < shown));
		this.#lotGroup.visible = shown > 0;

		const rivals = this.#state.nodata
			? 0
			: Math.max(0, Math.min(this.#signSpots.length, Math.round(this.#state.rivals)));
		this.#rivalMarks.count = rivals;
		// The same competitors, on the same buildings, one storey down. Only in a
		// catchment: the story's front row is its street, not somebody's competition.
		this.#rivalFronts = catchment ? Math.min(this.#shopfronts.count, rivals) : 0;
		// In the story a competitor wears the category's own faint tint, because the whole
		// scene is about that one trade. In a catchment it wears the red it is drawn in on
		// the map and counted in on the card: here it is not the subject, it is what is
		// already standing where the reader is thinking of opening.
		(this.#rivalMarks.material as THREE.MeshStandardMaterial).color.setHex(
			catchment ? RIVAL_COLOUR : tint
		);

		// Keyed on the competitors as well as the light: the shopfronts carry both, and
		// keyed on the light alone a change of business type repainted nothing.
		const paintKey = `${d.windowLights.toFixed(2)}|${this.#rivalFronts}`;
		if (paintKey !== this.#lastPaintKey) {
			this.#lastPaintKey = paintKey;
			this.#paintLights(d);
		}

		this.#applyTransit(catchment);

		// A lot's lines must always work against their ground: white over a dark model,
		// dark over a model lit by midday sun. Pinned to white, they disappear at exactly
		// the hour we most want to show.
		const lineDark = new THREE.Color(0x2a2f38);
		for (const m of this.#lotLineMats) {
			m.color.copy(lineDark).lerp(WHITE, d.streetLights);
		}

		(this.#lamps.material as THREE.MeshBasicMaterial).color
			.setHex(0x93908a)
			.lerp(LAMP_ON, d.streetLights);

		this.#layoutCrowd();
		this.#updateCamera();
		this.#dirty = true;
		// A reader who has asked for less motion gets no loop, so nothing would ever
		// redraw and a scrubbed hour would move the light without moving the picture.
		// A state change is not motion the scene decided on, it is the answer to
		// something the reader just did, and it has to be drawn.
		if (this.#reduced) this.renderOnce();
	}

	/**
	 * The stops this catchment actually has, revealed by the counts on the grid.
	 *
	 * The story keeps its street whole: one platform, one bus, no entrances. It stands
	 * for the product rather than for a place, and a landing page whose bus disappears
	 * would be making a claim about a cell nobody chose.
	 *
	 * NOT gated on `nodata`, unlike the competitors and the lots above. Those come from
	 * the premium catalogue, which has not read every city. The transit counts come from
	 * OpenStreetMap and are on the grid for every cell, so a catchment whose competitors
	 * nobody has counted can still be shown the station it is standing next to, which is
	 * the same rule the panel's own sections follow.
	 */
	#applyTransit(catchment: boolean) {
		const t = this.#state.transit;

		if (!catchment) {
			this.#stopGroup.visible = true;
			this.#bus.visible = true;
			this.#stopBand.color.setHex(0xe6e3dd);
			for (const e of this.#entrances) e.group.visible = false;
			for (const g of this.#shelters) g.visible = false;
			return;
		}

		// The platform is the first TransJakarta node, and the shelters are the rest. No
		// corridor in range takes the platform and the bus with it, so an area that is
		// only reachable by rail looks like one.
		const brt = Math.max(0, Math.round(t.brt));
		this.#stopGroup.visible = brt > 0;
		this.#bus.visible = brt > 0;
		this.#stopBand.color.setHex(MODE_COLOUR.brt);
		this.#shelters.forEach((g, i) => (g.visible = i < brt - 1));

		// One entrance per rail node, taking the modes in turn so a cell served by two
		// lines shows both colours rather than five of whichever came first.
		let i = 0;
		for (const mode of RAIL_MODES) {
			for (let k = 0; k < Math.max(0, Math.round(t[mode])); k++) {
				const e = this.#entrances[i];
				if (!e) break;
				e.group.visible = true;
				e.sign.color.setHex(MODE_COLOUR[mode]);
				e.canopy.color.setHex(MODE_COLOUR[mode]).lerp(WHITE, 0.5);
				i++;
			}
			if (i >= this.#entrances.length) break;
		}
		for (; i < this.#entrances.length; i++) this.#entrances[i].group.visible = false;
	}

	#paintLights(d: DaylightSample) {
		const warm = new THREE.Color(0xffe3bd);
		const cool = new THREE.Color(0xdae6f0);
		const off = new THREE.Color(0x9d9a94).lerp(new THREE.Color(0x23252d), d.streetLights);
		const glow = 0.3 + 0.7 * d.streetLights;

		const n = this.#windows.count;
		for (let i = 0; i < n; i++) {
			const seed = this.#windowSeeds[i] ?? 0.5;
			if (seed < d.windowLights) {
				this.#color
					.copy(seed % 0.31 < 0.11 ? cool : warm)
					.multiplyScalar((0.85 + seed * 0.3) * glow);
			} else {
				this.#color.copy(off);
			}
			this.#windows.setColorAt(i, this.#color);
		}
		if (this.#windows.instanceColor) this.#windows.instanceColor.needsUpdate = true;

		/**
		 * The ground floors, and the first few of them are the competition.
		 *
		 * This is the one thing in the model that says how crowded the trade already is,
		 * and it says it where the eye is: a band at street level on the buildings facing
		 * the road. The signboards above them were carrying that on their own and could
		 * not, being 3 m of board on a face at the edge of the frame.
		 *
		 * Unlit on purpose. The frontage material is basic and untone-mapped, so this
		 * colour is exactly the red the panel counts them in, at midday and at midnight
		 * alike. A competitor that faded out after dark would be a competitor that shut,
		 * which is a different fact and one this scene has not been told.
		 */
		const rival = new THREE.Color(RIVAL_COLOUR).lerp(WHITE, 0.18);
		const m = this.#shopfronts.count;
		for (let i = 0; i < m; i++) {
			if (i < this.#rivalFronts) {
				this.#shopfronts.setColorAt(i, rival);
				continue;
			}
			const seed = this.#windowSeeds[n + i] ?? 0.5;
			const level = Math.min(1, d.windowLights * 1.35);
			this.#color
				.copy(seed < level ? warm : off)
				.multiplyScalar(seed < level ? (0.7 + seed * 0.5) * glow : 1);
			this.#shopfronts.setColorAt(i, this.#color);
		}
		if (this.#shopfronts.instanceColor) this.#shopfronts.instanceColor.needsUpdate = true;
	}

	#updateCamera() {
		const t = Math.max(0, Math.min(1, this.#state.cameraT));
		const e = t * t * (3 - 2 * t);

		// A short isometric orbit: the viewing angle stays oblique and only rotates a
		// little as it closes in on the cafe. A drastically changing angle would wreck the
		// reading of the plan.
		const azim = Math.PI * (0.72 + e * 0.1);
		const elev = 0.62 - e * 0.1;
		// On an orthographic camera, distance does not change scale at all — but fog is
		// computed from the distance to the camera. Set far away (120 m, once), the whole
		// scene fogged evenly and the model turned milky; set just outside the block, the
		// fog works as it should again: far things dissolve, near things stay clear.
		const dist = 32;

		// The look-at point is locked to the cluster that carries the story — the stop,
		// the cafe, and the empty lot beside it — then closes in on the cafe's frontage.
		// Framing the block generally shrinks all three and none of them reads.
		const cx = 8 + e * 6;
		const cz = 2 - e * 4;

		this.#camera.position.set(
			cx + Math.cos(azim) * Math.cos(elev) * dist,
			Math.sin(elev) * dist,
			cz + Math.sin(azim) * Math.cos(elev) * dist
		);
		this.#camera.lookAt(cx, 3, cz);

		// "Zoom" on an orthographic camera is the frustum width, not the distance.
		// Opened wide: the whole model slab fits a wide screen, its edge is visible, and
		// the eye immediately reads "an object on a table". Only then does it close in on
		// the cafe. Close, but never so close it loses the context: in the tightest frame
		// the cafe and the stop still have to be visible beside the empty lot — comparing
		// those three is what the final panel is about.
		this.#viewWidth = 118 - e * 58;
		this.#applyFrustum();

		// The bus pulls up to the stop as you scroll — the only object that genuinely
		// moves, so the eye knows at once where to look.
		this.#bus.position.z = 31 - e * 31;
	}

	#viewWidth = 118;

	#applyFrustum() {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		const aspect = w / h;

		// On a portrait screen, dividing a fixed width by the aspect ratio gives a huge
		// vertical span: the model shrinks to a strip down the middle, the rest sky and
		// empty ground. So the vertical span is capped, and narrow screens close in
		// (cropping sideways) instead of pulling back.
		let halfW = this.#viewWidth / 2;
		let halfH = halfW / aspect;
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
	}

	get daylight(): DaylightSample {
		return this.#day;
	}

	/* ── lifecycle ────────────────────────────────────────────────────────── */

	resize() {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		this.#renderer.setSize(w, h, false);
		this.#applyFrustum();
		this.#dirty = true;
		this.renderOnce();
	}

	renderOnce() {
		this.#renderer.render(this.#scene, this.#camera);
		this.#dirty = false;
	}

	/**
	 * The scene is frozen, so this loop is not an animation: it just waits for the
	 * state to change. A frame is drawn when something changes; otherwise the GPU idles.
	 */
	start() {
		if (this.#running) return;
		if (this.#reduced) {
			this.renderOnce();
			return;
		}
		this.#running = true;
		// One frame immediately, without waiting for rAF: a canvas that has been off
		// screen for a while can be cleared by the compositor, and a scene whose state
		// has not changed would never redraw to fill it back in.
		this.renderOnce();
		const loop = () => {
			this.#raf = requestAnimationFrame(loop);
			if (this.#dirty) this.renderOnce();
		};
		this.#raf = requestAnimationFrame(loop);
	}

	stop() {
		this.#running = false;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	dispose() {
		this.stop();
		this.#hatchTex?.dispose();
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
