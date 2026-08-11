/**
 * Kisi heksagon sebagai maket — adegan kedua di halaman depan.
 *
 * Ini bukan peta. Petaknya tidak berada di koordinat mana pun dan tingginya
 * bukan skor kawasan mana pun; yang ditunjukkan adalah *cara membacanya*: satu
 * petak satu heksagon, tingginya peluang, yang belum terdata dibiarkan berlubang,
 * dan alat ukur digambar di atasnya seperti pada gambar kerja. Karena itu ia
 * memakai bahasa bentuk yang sama dengan maket jalan di atasnya:
 *
 * 1. **Isometrik.** Kamera ortografis dari atas-samping; hubungan antar petak
 *    yang dijual, bukan perspektifnya.
 * 2. **Serba putih.** Tidak ada warna jenuh pada bendanya. Satu-satunya warna
 *    datang dari aksen pada gizmo — dan itu pun tipis.
 * 3. **Digerakkan gulir, bukan waktu.** Tidak ada rAF yang berputar sia-sia:
 *    bingkai hanya digambar saat keadaannya benar-benar berubah.
 *
 * Gizmonya memakai konvensi yang sudah dipakai maket jalan: garis penuh untuk
 * yang terukur, garis putus-putus untuk yang masih usulan atau jangkauan.
 */

import * as THREE from 'three';

export interface GridState {
	/** 0..1 — posisi pada lintasan gulir. */
	progress: number;
	/** Warna garis alat ukur, diambil dari token tema oleh pemanggil. */
	ink: string;
	accent: string;
}

const DEFAULT_STATE: GridState = { progress: 0, ink: '#1c1a16', accent: '#0071e3' };

/* Denah kisi. Ukurannya dipilih supaya seluruh bidang muat pada bingkai lebar
   tanpa petaknya mengecil jadi butiran. */
const RINGS = 5;
const CELL = 3.15;
/** Jari-jari badan petak; sedikit lebih kecil dari jarak antar petak → ada sela. */
const BODY = CELL * 0.93;
const BASE_R = CELL * (RINGS + 0.95) * 1.732;

/** Petak yang jadi pokok: tempat alat ukur dipasang. */
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

/** Koordinat aksial → posisi datar, susunan flat-top. */
function axialToXZ(q: number, r: number): [number, number] {
	return [CELL * 1.5 * q, CELL * Math.sqrt(3) * (r + q / 2)];
}

interface Cell {
	x: number;
	z: number;
	/** Tinggi akhir petak; 0 berarti belum terdata. */
	h: number;
	nodata: boolean;
	/** Jarak dari petak pokok — dipakai sebagai urutan gelombang naiknya. */
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
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;

		this.#camera = new THREE.OrthographicCamera(-30, 30, 22, -22, -200, 400);

		this.#layout();
		this.#buildLights(small ? 1024 : 2048);
		this.#buildBase();
		this.#buildTiles();
		this.#buildGizmos();

		this.applyState({});
		this.resize();
	}

	/* ── denah ────────────────────────────────────────────────────────────── */

	#layout() {
		const rnd = mulberry32(60413);
		const [fx, fz] = axialToXZ(FOCUS.q, FOCUS.r);

		for (let q = -RINGS; q <= RINGS; q++) {
			const lo = Math.max(-RINGS, -q - RINGS);
			const hi = Math.min(RINGS, -q + RINGS);
			for (let r = lo; r <= hi; r++) {
				const [x, z] = axialToXZ(q, r);
				// Nilainya tidak mewakili kawasan mana pun: yang perlu terbaca cuma
				// "tiap petak punya angkanya sendiri", jadi bentuknya dibuat menurun
				// dari tengah supaya bidangnya punya punggung, bukan gerigi acak.
				const d = Math.hypot(x, z) / (CELL * RINGS * 1.8);
				// Selisih tingginya harus terbaca dari jauh: pada rentang yang terlalu
				// rapat, kisinya kembali jadi bidang rata dan pesannya hilang.
				const h = Math.max(0.5, (1.1 - d * 0.8) * (0.4 + rnd())) * 5.4;
				this.#cells.push({
					x,
					z,
					h,
					nodata: rnd() < 0.14,
					wave: Math.hypot(x - fx, z - fz)
				});
			}
		}

		const maxWave = Math.max(...this.#cells.map((c) => c.wave)) || 1;
		for (const c of this.#cells) c.wave /= maxWave;
	}

	/* ── cahaya & alas ────────────────────────────────────────────────────── */

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
		// Cahaya studio yang tetap: adegan ini soal kisinya, bukan soal jam.
		this.#sun.position.set(-38, 62, 34);
		this.#scene.add(this.#sun, this.#sun.target, this.#hemi);
	}

	#buildBase() {
		// Pelat alas dengan tebal yang terlihat — isyarat yang sama dengan maket
		// jalan: ini benda di atas meja, bukan peta yang membentang tanpa tepi.
		const slab = new THREE.Mesh(
			new THREE.CylinderGeometry(BASE_R, BASE_R, 1.5, 6),
			new THREE.MeshStandardMaterial({ color: 0xdedad3, roughness: 0.96 })
		);
		slab.rotation.y = Math.PI / 6;
		slab.position.y = -0.75;
		slab.receiveShadow = true;
		this.#scene.add(slab);
	}

	/* ── petak ────────────────────────────────────────────────────────────── */

	#buildTiles() {
		const geo = new THREE.CylinderGeometry(BODY, BODY, 1, 6);
		// Tinggi diskalakan dari alasnya, bukan dari tengahnya, supaya petak
		// tumbuh ke atas seperti balok yang diletakkan — bukan mengembang ke dua arah.
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

		// Petak tanpa data: cekungan tipis, bukan balok pendek. Balok pendek tetap
		// terbaca sebagai "nilainya kecil"; cekungan terbaca sebagai tidak tahu.
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

	/* ── alat ukur ────────────────────────────────────────────────────────── */

	#buildGizmos() {
		/* Alat ukur digambar menembus benda — memang begitulah alat ukur bekerja
		   pada gambar kerja, dan tanpa itu seluruhnya terkubur di bawah petak yang
		   berdiri setinggi tiga meter. `depthTest: false` plus urutan gambar paling
		   belakang membuatnya selalu terbaca, seperti garis yang ditarik di atas
		   cetakan. */
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

		// 1. Cincin jangkauan jalan kaki — garis putus-putus: ini jangkauan, bukan benda.
		const R = CELL * 3.4;
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= 96; i++) {
			const a = (i / 96) * Math.PI * 2;
			pts.push(new THREE.Vector3(fx + Math.cos(a) * R, 0.06, fz + Math.sin(a) * R));
		}
		const ringMat = line(true);
		this.#ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
		this.#ring.computeLineDistances();
		this.#accentMats.push(ringMat);
		this.#ring.renderOrder = 10;
		this.#scene.add(this.#ring);

		// 2. Garis ukur dengan dua sengkang di ujungnya — cara baku menuliskan jarak.
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

		// 3. Bidik pada petak pokok: silang dan satu petak kecil.
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
		this.#accentMats.push(crossMat);
		this.#cross.renderOrder = 10;
		this.#scene.add(this.#cross);

		// 4. Pin tegak: menandai petak pokok sampai ke puncaknya, dengan simpul kecil
		//    di ujung — sama seperti penanda ketinggian pada gambar potongan.
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
		this.#accentMats.push(pinMat, knobMat);
		this.#pin.renderOrder = 10;
		this.#scene.add(this.#pin);
	}

	/* ── keadaan ──────────────────────────────────────────────────────────── */

	applyState(partial: Partial<GridState>) {
		this.#state = { ...this.#state, ...partial };
		const p = Math.max(0, Math.min(1, this.#state.progress));
		// Gulir yang mentah terasa kaku pada awal dan akhir; kurva ini yang
		// membuat kisinya seolah punya massa.
		const e = p * p * (3 - 2 * p);

		this.#paintGizmos();
		this.#layoutTiles(e);
		this.#updateCamera(e);
		this.#dirty = true;
	}

	/** Tinta gizmo diambil dari tema halaman, bukan dipatok putih. */
	#paintGizmos() {
		for (const m of this.#gizmoMats) m.color.set(this.#state.ink);
		for (const m of this.#accentMats) m.color.set(this.#state.accent);
	}

	#layoutTiles(e: number) {
		const solid = this.#cells.filter((c) => !c.nodata);

		solid.forEach((c, i) => {
			// Gelombang berangkat dari petak pokok ke tepi: yang dekat lebih dulu
			// berdiri. Inilah yang membuat kisinya terbaca "sedang dinilai", bukan
			// sekadar muncul.
			const local = Math.max(0, Math.min(1, (e * 1.75 - c.wave * 0.75) / 1));
			const grow = local * local * (3 - 2 * local);
			const h = Math.max(0.06, c.h * grow);

			this.#dummy.position.set(c.x, 0, c.z);
			this.#dummy.rotation.set(0, 0, 0);
			this.#dummy.scale.set(1, h, 1);
			this.#dummy.updateMatrix();
			this.#tiles.setMatrixAt(i, this.#dummy.matrix);

			// Nilai putihnya bergeser setipis mungkin menurut tinggi — cukup untuk
			// memisahkan puncak dari lembah, tidak sampai jadi peta berwarna.
			const v = 0.86 + (h / 5.4) * 0.12;
			this.#color.setRGB(v, v * 0.995, v * 0.983);
			this.#tiles.setColorAt(i, this.#color);
		});
		this.#tiles.instanceMatrix.needsUpdate = true;
		if (this.#tiles.instanceColor) this.#tiles.instanceColor.needsUpdate = true;

		// Alat ukur datang setelah petaknya berdiri, satu per satu — bukan
		// serentak, supaya urutan membacanya jelas.
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
		// Orbit isometrik pendek. Sudut yang berubah drastis merusak bacaan denah,
		// jadi yang bergerak hanya belasan derajat — cukup untuk terasa hidup.
		const azim = Math.PI * (0.68 + e * 0.16);
		const elev = 0.66 - e * 0.06;
		const dist = 60;

		this.#camera.position.set(
			Math.cos(azim) * Math.cos(elev) * dist,
			Math.sin(elev) * dist,
			Math.sin(azim) * Math.cos(elev) * dist
		);
		this.#camera.lookAt(0, 1.2, 0);

		// Dibuka cukup lebar supaya tepi pelat terlihat — itu yang memberi tahu mata
		// bahwa ini benda di atas meja — lalu merapat sedikit saja.
		this.#viewWidth = 104 - e * 16;
		this.#applyFrustum();
	}

	#applyFrustum() {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		const aspect = w / h;

		// Layar sempit memberi bingkai yang kecil; kalau bentangnya tetap, maketnya
		// menyusut jadi butiran di tengah kartu. Dirapatkan sedikit, bukan dibiarkan.
		const view = this.#viewWidth * (w < 520 ? 0.84 : 1);
		let halfW = view / 2;
		let halfH = halfW / aspect;
		// Pada layar potret, bentang tegak yang mengikuti rasio membuat kisinya
		// menyusut jadi pita di tengah. Dibatasi, lalu layar sempit merapat.
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

	/* ── siklus hidup ─────────────────────────────────────────────────────── */

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
		// Satu bingkai langsung, tanpa menunggu rAF: kanvas yang lama di luar layar
		// bisa dikosongkan kompositor, dan adegan yang keadaannya tidak berubah
		// tidak akan pernah menggambar ulang untuk mengisinya.
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
