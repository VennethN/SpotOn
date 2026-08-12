/**
 * The hexagon grid as a physical model — the landing page's second scene.
 *
 * This is not a map. Its cells sit at no coordinates and their heights are no
 * area's score; what it shows is *how to read one*: one cell per hexagon, height is
 * opportunity, cells with no data are left as holes, and measuring marks are drawn
 * over the top the way they are on a working drawing. It therefore speaks the same
 * visual language as the street diorama above it:
 *
 * 1. **Isometric.** An orthographic camera from above and to the side; what is on
 *    offer is the relationship between cells, not the perspective.
 * 2. **Colour has a job.** Unlike the all-white street diorama, this grid is a heat
 *    map: every cell is coloured from exactly the same opportunity ramp the map
 *    inside the app uses. Height and colour carry the same value — deliberately, as
 *    this is where the reader learns to read the legend before reaching the map.
 *    Cells with no data stay off the ramp entirely.
 * 3. **Driven by scroll, not by time.** No rAF spinning for nothing: a frame is
 *    only drawn when the state actually changes.
 *
 * The gizmos follow the convention the street diorama already established: solid
 * lines for what is measured, dashed lines for what is proposed or a range.
 */

import * as THREE from 'three';

export interface GridState {
	/** 0..1 — position along the scroll track. */
	progress: number;
	/** Colour of the measuring lines, taken from theme tokens by the caller. */
	ink: string;
	accent: string;
	/** The seven-step opportunity ramp — the `--ramp-0..6` tokens verbatim. */
	ramp: string[];
	/** Colour for cells with no data; deliberately off the ramp. */
	nodata: string;
}

const DEFAULT_RAMP = ['#dbe7f7', '#b3cdf0', '#86b0e6', '#5691dc', '#2f72cd', '#1c56a5', '#143f7c'];

const DEFAULT_STATE: GridState = {
	progress: 0,
	ink: '#1c1a16',
	accent: '#0071e3',
	ramp: DEFAULT_RAMP,
	nodata: '#9aa2ad'
};

/* The grid's plan. Sized so the whole field fits a wide frame without its cells
   shrinking to grains. */
const RINGS = 5;
const CELL = 3.15;
/** Radius of a cell's body; slightly less than the cell pitch → there is a gap. */
const BODY = CELL * 0.93;
const BASE_R = CELL * (RINGS + 0.95) * 1.732;

/** The focus cell: where the measuring marks are attached. */
const FOCUS = { q: 1, r: -1 };

function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Axial coordinates → a flat position, flat-top layout. */
function axialToXZ(q: number, r: number): [number, number] {
	return [CELL * 1.5 * q, CELL * Math.sqrt(3) * (r + q / 2)];
}

/** Height of the highest-opportunity cell, in scene units. */
const MAX_H = 5.4;

interface Cell {
	x: number;
	z: number;
	/** Score 0..1. Both colour and height are read from this. */
	score: number;
	/** The cell's final height. */
	h: number;
	nodata: boolean;
	/** Distance from the focus cell — used as the order of the rising wave. */
	wave: number;
}

export class GridWorld {
	#renderer: THREE.WebGLRenderer;
	#scene = new THREE.Scene();
	#camera: THREE.OrthographicCamera;
	#canvas: HTMLCanvasElement;

	#sun = new THREE.DirectionalLight(0xffffff, 2.6);
	#hemi = new THREE.HemisphereLight(0xffffff, 0x9aa2ad, 1.15);

	#cells: Cell[] = [];
	#tiles!: THREE.InstancedMesh;
	#holes!: THREE.InstancedMesh;
	#ring!: THREE.Line;
	#dim = new THREE.Group();
	#cross = new THREE.Group();
	#pin = new THREE.Group();
	#gizmoMats: Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial> = [];
	#accentMats: Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial> = [];

	#state: GridState = { ...DEFAULT_STATE };
	/** The ramp currently applied; used so cells are not repainted every frame. */
	#paintedRamp = '';
	#raf = 0;
	#running = false;
	#reduced: boolean;
	#dirty = true;
	#dummy = new THREE.Object3D();
	#color = new THREE.Color();
	#viewWidth = 104;

	constructor(canvas: HTMLCanvasElement, opts: { reducedMotion?: boolean } = {}) {
		this.#canvas = canvas;
		this.#reduced = opts.reducedMotion ?? false;

		this.#renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});
		const small = window.innerWidth < 768;
		this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
		this.#renderer.setClearAlpha(0);
		this.#renderer.shadowMap.enabled = true;
		this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		// No filmic tone mapping: this scene teaches the map's colour ramp, so the
		// colours have to arrive as they are. ACES is more cinematic, but it pushes the
		// darkest step towards grey and the legend stops matching.
		this.#renderer.toneMapping = THREE.NoToneMapping;

		this.#camera = new THREE.OrthographicCamera(-30, 30, 22, -22, -200, 400);

		this.#layout();
		this.#buildLights(small ? 1024 : 2048);
		this.#buildBase();
		this.#buildTiles();
		this.#buildGizmos();

		this.applyState({});
		this.resize();
	}

	/* ── plan ─────────────────────────────────────────────────────────────── */

	#layout() {
		const rnd = mulberry32(60413);
		const [fx, fz] = axialToXZ(FOCUS.q, FOCUS.r);

		for (let q = -RINGS; q <= RINGS; q++) {
			const lo = Math.max(-RINGS, -q - RINGS);
			const hi = Math.min(RINGS, -q + RINGS);
			for (let r = lo; r <= hi; r++) {
				const [x, z] = axialToXZ(q, r);
				// The values represent no real area: all that needs to read is "every
				// cell has its own figure", so the shape falls away from the centre and
				// the field has a ridge rather than a random sawtooth.
				const d = Math.hypot(x, z) / (CELL * RINGS * 1.8);
				// The differences have to read from a distance: on too tight a range the
				// grid flattens back into a plane and the point is lost.
				const score = Math.max(0.09, Math.min(1, (1.1 - d * 0.8) * (0.4 + rnd())));
				this.#cells.push({
					x,
					z,
					score,
					h: score * MAX_H,
					nodata: rnd() < 0.14,
					wave: Math.hypot(x - fx, z - fz)
				});
			}
		}

		const maxWave = Math.max(...this.#cells.map((c) => c.wave)) || 1;
		for (const c of this.#cells) c.wave /= maxWave;
	}

	/* ── light & base ─────────────────────────────────────────────────────── */

	#buildLights(shadowSize: number) {
		this.#sun.castShadow = true;
		this.#sun.shadow.mapSize.set(shadowSize, shadowSize);
		const s = this.#sun.shadow.camera;
		s.left = -40;
		s.right = 40;
		s.top = 40;
		s.bottom = -40;
		s.near = 1;
		s.far = 200;
		this.#sun.shadow.bias = -0.0007;
		this.#sun.shadow.normalBias = 0.02;
		// Fixed studio lighting: this scene is about the grid, not about the hour.
		this.#sun.position.set(-38, 62, 34);
		this.#scene.add(this.#sun, this.#sun.target, this.#hemi);
	}

	#buildBase() {
		// A base slab with visible thickness — the same cue the street diorama uses:
		// this is an object on a table, not a map stretching on without an edge.
		const slab = new THREE.Mesh(
			new THREE.CylinderGeometry(BASE_R, BASE_R, 1.5, 6),
			new THREE.MeshStandardMaterial({ color: 0xdedad3, roughness: 0.96 })
		);
		slab.rotation.y = Math.PI / 6;
		slab.position.y = -0.75;
		slab.receiveShadow = true;
		this.#scene.add(slab);
	}

	/* ── cells ────────────────────────────────────────────────────────────── */

	#buildTiles() {
		const geo = new THREE.CylinderGeometry(BODY, BODY, 1, 6);
		// Height is scaled from the base rather than the centre, so a cell grows upward
		// like a block being set down — not outward in both directions.
		geo.translate(0, 0.5, 0);
		geo.rotateY(Math.PI / 6);

		const solid = this.#cells.filter((c) => !c.nodata);
		this.#tiles = new THREE.InstancedMesh(
			geo,
			new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.02 }),
			solid.length
		);
		this.#tiles.castShadow = true;
		this.#tiles.receiveShadow = true;
		this.#scene.add(this.#tiles);

		// Cells with no data: a shallow recess, not a short block. A short block still
		// reads as "a small value"; a recess reads as not knowing.
		const holeGeo = new THREE.CylinderGeometry(BODY, BODY, 0.28, 6);
		holeGeo.rotateY(Math.PI / 6);
		const holes = this.#cells.filter((c) => c.nodata);
		this.#holes = new THREE.InstancedMesh(
			holeGeo,
			new THREE.MeshStandardMaterial({ color: 0xc3bfb8, roughness: 0.98 }),
			holes.length
		);
		this.#holes.receiveShadow = true;
		holes.forEach((c, i) => {
			this.#dummy.position.set(c.x, 0.14, c.z);
			this.#dummy.rotation.set(0, 0, 0);
			this.#dummy.scale.setScalar(1);
			this.#dummy.updateMatrix();
			this.#holes.setMatrixAt(i, this.#dummy.matrix);
		});
		this.#scene.add(this.#holes);
	}

	/* ── measuring marks ──────────────────────────────────────────────────── */

	#buildGizmos() {
		/* The marks are drawn straight through the objects — that is exactly how
		   measuring marks work on a working drawing, and without it they would all be
		   buried under cells standing three metres tall. `depthTest: false` plus the
		   last render order keeps them always legible, like lines drawn over a print. */
		const overlay = <T extends THREE.Material>(m: T): T => {
			m.depthTest = false;
			m.depthWrite = false;
			return m;
		};
		const line = (dashed: boolean) =>
			overlay(
				dashed
					? new THREE.LineDashedMaterial({
							color: 0xffffff,
							dashSize: 0.7,
							gapSize: 0.45,
							transparent: true,
							opacity: 0.92
						})
					: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 })
			);

		const [fx, fz] = axialToXZ(FOCUS.q, FOCUS.r);

		// 1. The walking-range ring — dashed: this is a range, not an object.
		const R = CELL * 3.4;
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= 96; i++) {
			const a = (i / 96) * Math.PI * 2;
			pts.push(new THREE.Vector3(fx + Math.cos(a) * R, 0.06, fz + Math.sin(a) * R));
		}
		const ringMat = line(true);
		this.#ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
		this.#ring.computeLineDistances();
		// Ink, not accent. Ever since the cells were coloured with the blue ramp, a blue
		// line over them stopped reading — and on a working drawing the measuring marks
		// are drawn in ink anyway, not in the data's colour.
		this.#gizmoMats.push(ringMat);
		this.#ring.renderOrder = 10;
		this.#scene.add(this.#ring);

		// 2. A dimension line with a tick at each end — the standard way to write a distance.
		const dimMat = line(false);
		const t = 0.62;
		const dimPts = [
			new THREE.Vector3(fx, 0.06, fz),
			new THREE.Vector3(fx + R, 0.06, fz),
			new THREE.Vector3(fx, -t, fz),
			new THREE.Vector3(fx, t, fz),
			new THREE.Vector3(fx + R, -t, fz),
			new THREE.Vector3(fx + R, t, fz)
		];
		this.#dim.add(
			new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dimPts), dimMat)
		);
		this.#gizmoMats.push(dimMat);
		this.#dim.renderOrder = 10;
		this.#scene.add(this.#dim);

		// 3. A sight on the focus cell: a crosshair.
		const crossMat = line(false);
		const c = 1.5;
		const crossPts = [
			new THREE.Vector3(fx - c, 0.08, fz),
			new THREE.Vector3(fx + c, 0.08, fz),
			new THREE.Vector3(fx, 0.08, fz - c),
			new THREE.Vector3(fx, 0.08, fz + c)
		];
		this.#cross.add(
			new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPts), crossMat)
		);
		this.#gizmoMats.push(crossMat);
		this.#cross.renderOrder = 10;
		this.#scene.add(this.#cross);

		// 4. An upright pin: marks the focus cell up to its top, with a small knob at
		//    the end — just like a height marker on a section drawing.
		const pinMat = line(false);
		this.#pin.add(
			new THREE.LineSegments(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(fx, 0, fz),
					new THREE.Vector3(fx, 1, fz)
				]),
				pinMat
			)
		);
		const knobMat = overlay(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
		const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), knobMat);
		knob.position.set(fx, 1, fz);
		this.#pin.add(knob);
		// A single accent point, at the pin's tip: the marker for "this is what is targeted".
		this.#gizmoMats.push(pinMat);
		this.#accentMats.push(knobMat);
		this.#pin.renderOrder = 10;
		this.#scene.add(this.#pin);
	}

	/* ── state ────────────────────────────────────────────────────────────── */

	applyState(partial: Partial<GridState>) {
		this.#state = { ...this.#state, ...partial };
		const p = Math.max(0, Math.min(1, this.#state.progress));
		// Raw scroll feels stiff at the start and the end; this curve is what gives the
		// grid the sense of having mass.
		const e = p * p * (3 - 2 * p);

		this.#paintGizmos();
		this.#paintTiles();
		this.#layoutTiles(e);
		this.#updateCamera(e);
		this.#dirty = true;
	}

	/** Gizmo ink comes from the page theme rather than being pinned to white. */
	#paintGizmos() {
		for (const m of this.#gizmoMats) m.color.set(this.#state.ink);
		for (const m of this.#accentMats) m.color.set(this.#state.accent);
	}

	/**
	 * Cell colour by score, from the same ramp the map uses.
	 *
	 * Mixed slightly towards white because the object is still a lit model, not a
	 * painted surface: without it the darkest step becomes a black hole that swallows
	 * the shadow and the hexagon's shape disappears. The value still reads — what is
	 * reduced is the saturation, not the ordering.
	 */
	#paintTiles() {
		const key = this.#state.ramp.join('|') + this.#state.nodata;
		if (key === this.#paintedRamp) return;
		this.#paintedRamp = key;

		const steps = this.#state.ramp.length ? this.#state.ramp : DEFAULT_RAMP;
		const white = new THREE.Color(0xffffff);
		const solid = this.#cells.filter((c) => !c.nodata);

		solid.forEach((c, i) => {
			const step = Math.max(0, Math.min(steps.length - 1, Math.round(c.score * (steps.length - 1))));
			this.#color.set(steps[step]).lerp(white, 0.1);
			this.#tiles.setColorAt(i, this.#color);
		});
		if (this.#tiles.instanceColor) this.#tiles.instanceColor.needsUpdate = true;

		// No-data never joins the ramp: it is not a small value, it is not a value.
		(this.#holes.material as THREE.MeshStandardMaterial).color
			.set(this.#state.nodata)
			.lerp(white, 0.3);
	}

	#layoutTiles(e: number) {
		const solid = this.#cells.filter((c) => !c.nodata);

		solid.forEach((c, i) => {
			// The wave sets off from the focus cell towards the edge: the near ones stand
			// up first. This is what makes the grid read as "being scored" rather than
			// simply appearing.
			const local = Math.max(0, Math.min(1, (e * 1.75 - c.wave * 0.75) / 1));
			const grow = local * local * (3 - 2 * local);
			const h = Math.max(0.06, c.h * grow);

			this.#dummy.position.set(c.x, 0, c.z);
			this.#dummy.rotation.set(0, 0, 0);
			this.#dummy.scale.set(1, h, 1);
			this.#dummy.updateMatrix();
			this.#tiles.setMatrixAt(i, this.#dummy.matrix);
		});
		this.#tiles.instanceMatrix.needsUpdate = true;

		// The measuring marks arrive after the cells have stood up, one at a time —
		// not all at once, so the reading order is clear.
		const focus = solid.find((c) => Math.abs(c.wave) < 0.001);
		const at = (a: number, b: number) => Math.max(0, Math.min(1, (e - a) / (b - a)));

		const ringT = at(0.18, 0.52);
		this.#ring.visible = ringT > 0.001;
		this.#ring.scale.set(ringT, 1, ringT);
		const [fx, fz] = axialToXZ(FOCUS.q, FOCUS.r);
		this.#ring.position.set(fx * (1 - ringT), 0, fz * (1 - ringT));

		const dimT = at(0.46, 0.72);
		this.#dim.visible = dimT > 0.001;
		this.#dim.scale.setScalar(dimT);
		this.#dim.position.set(fx * (1 - dimT), 0, fz * (1 - dimT));

		this.#cross.visible = at(0.1, 0.3) > 0.001;

		const pinT = at(0.62, 0.9);
		this.#pin.visible = pinT > 0.001;
		const pinH = (focus?.h ?? 3) * 1.45 * pinT;
		this.#pin.scale.set(1, Math.max(0.001, pinH), 1);
	}

	#updateCamera(e: number) {
		// A short isometric orbit. A drastically changing angle wrecks the reading of
		// the plan, so it only moves a dozen or so degrees — enough to feel alive.
		const azim = Math.PI * (0.68 + e * 0.16);
		const elev = 0.66 - e * 0.06;
		const dist = 60;

		this.#camera.position.set(
			Math.cos(azim) * Math.cos(elev) * dist,
			Math.sin(elev) * dist,
			Math.sin(azim) * Math.cos(elev) * dist
		);
		this.#camera.lookAt(0, 1.2, 0);

		// Opened wide enough that the slab's edge is visible — that is what tells the
		// eye this is an object on a table — then closing in just slightly.
		this.#viewWidth = 104 - e * 16;
		this.#applyFrustum();
	}

	#applyFrustum() {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		const aspect = w / h;

		// A narrow screen gives a small frame; with a fixed span the model shrinks to a
		// grain in the middle of the card. Tightened a little rather than left alone.
		const view = this.#viewWidth * (w < 520 ? 0.84 : 1);
		let halfW = view / 2;
		let halfH = halfW / aspect;
		// On a portrait screen, a vertical span that follows the aspect ratio shrinks
		// the grid into a strip down the middle. Capped, then narrow screens tighten in.
		const maxHalfH = view * 0.5;
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
