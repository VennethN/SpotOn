/**
 * Maket isometrik satu blok di sekitar halte transit — kafe sebagai pokoknya.
 *
 * Tiga keputusan bentuk yang mengikat seluruh berkas ini:
 *
 * 1. **Isometrik.** Kamera ortografis, dilihat dari atas-samping. Yang dijual
 *    adalah hubungan antar benda (kafe ↔ halte ↔ petak kosong), dan proyeksi
 *    ortografis memperlihatkan hubungan itu tanpa distorsi perspektif.
 * 2. **Serba putih.** Tidak ada warna jenuh. Nilai dibedakan setipis mungkin,
 *    dan seluruh warna datang dari cahaya jam yang sedang dipilih.
 * 3. **Orang membeku.** Tidak ada animasi idle. Setiap figur dipahat pada satu
 *    pose — sebagian tengah melangkah, sebagian duduk, sebagian mengantre — dan
 *    satu-satunya yang bergerak adalah apa yang digerakkan gulir. Karena itu
 *    tidak ada rAF yang berputar sia-sia: bingkai hanya digambar saat keadaan
 *    benar-benar berubah.
 */

import * as THREE from 'three';
import type { CategoryKey } from '$lib/types';
import { daylightAt, type DaylightSample } from './daylight';

export interface StreetState {
	/** 0..24 */
	hour: number;
	/** 0..1 — keramaian, hasil normalisasi profil `jam[]`. */
	density: number;
	category: CategoryKey;
	/** 0..1 — posisi pada lintasan kamera. */
	cameraT: number;
	/** Hex belum terdata: blok dikosongkan, petak ditandai. */
	nodata: boolean;
	/** Pesaing sejenis di kawasan ini — dibaca sebagai gerai bertanda di blok. */
	rivals: number;
	/** Ruang usaha yang sedang disewakan — dibaca sebagai petak bergaris. */
	vacancies: number;
}

const DEFAULT_STATE: StreetState = {
	hour: 12,
	density: 0.5,
	category: 'kopi',
	cameraT: 0,
	nodata: false,
	rivals: 0,
	vacancies: 1
};

const WHITE = new THREE.Color(0xffffff);
const LAMP_ON = new THREE.Color(0xffdcb0);

/** Semburat sangat lemah per jenis usaha — cukup untuk membedakan, tidak untuk berteriak. */
const CATEGORY_TINT: Record<CategoryKey, number> = {
	kopi: 0xd8c3aa,
	warung: 0xbfd2c2,
	minimarket: 0xe0c2ba,
	laundry: 0xc2d1dc,
	apotek: 0xbdd6c9
};

/* Denah blok, dalam meter. Jalan membujur pada sumbu Z. */
const BASE = 96;
const ROAD_HALF = 9;
const WALK_HALF = 13.5;
/** Tinggi trotoar. Perabot dan orang berdiri di atasnya, bukan di aspal. */
const WALK_Y = 0.18;
const HALTE_Z = 0;
const HALTE_LEN = 17;
const HALTE_HALF = 2.6;
/** Tinggi peron. Yang menunggu berdiri DI ATAS angka ini, bukan di tanah. */
const HALTE_Y = 1.0;
/* Halte TransJakarta berdiri di median dan busnya merapat di sampingnya, bukan
   menembusnya. Dua lajur mengapit peron — persis seperti koridor sungguhan. */
const BUS_LANE_W = 3.5;
const BUS_LANE_X = HALTE_HALF + BUS_LANE_W / 2;
const CAFE_X = 19;
const CAFE_Z = -9;
const CAFE_W = 11;
const CAFE_D = 13;

/* Petak sewa menempel pada kafe: dinding ke dinding. Berjauhan, mata harus
   menebak hubungan keduanya; berdampingan, perbandingannya langsung terbaca.
   Lebarnya disamakan dengan kafe supaya dua benda ini benar-benar sebanding. */
const LOT_X = CAFE_X;
const LOT_PAD_W = CAFE_W;
const LOT_PAD_D = 9.6;
const LOT_GAP = 1.3;
/* Tiga slot berjajar. Berapa yang ditampilkan ditentukan data, bukan komposisi:
   nol ruang disewakan harus benar-benar terlihat sebagai nol. Titik tengahnya
   dihitung, tidak ditulis tangan — angka yang ditulis tangan pernah membuat
   petak kedua dan ketiga bertindihan dengan tetangganya. */
const LOT_SLOTS = [0, 1, 2].map(
	(i) => CAFE_Z + CAFE_D / 2 + LOT_GAP + LOT_PAD_D / 2 + i * (LOT_PAD_D + LOT_GAP)
);

/* Pita yang disediakan untuk pokok cerita di sisi kanan: kafe, lalu deret petak
   sewa. Tidak ada massa bangunan yang boleh masuk ke sini. Inilah yang dulu bocor —
   penjagaannya hanya menutupi petak pertama dan hanya menguji titik tengah blok,
   sehingga bangunan tetangga tumbuh menembus petak yang justru harus terbaca kosong. */
const SUBJECT_Z0 = CAFE_Z - CAFE_D / 2 - 1.8;
const SUBJECT_Z1 = LOT_SLOTS[LOT_SLOTS.length - 1] + LOT_PAD_D / 2 + 1.8;

const MAX_RIVALS = 10;

const MAX_WALKERS = 96;
const MAX_SEATED = 16;
const MAX_CAFE_STAND = 18;
const MAX_HALTE = 24;
const MAX_PEOPLE = MAX_WALKERS + MAX_SEATED + MAX_CAFE_STAND + MAX_HALTE;

type Pose = 'walk' | 'stand' | 'sit';

interface Person {
	x: number;
	z: number;
	yaw: number;
	/** Fase langkah yang dibekukan — bukan waktu, hanya sudut kaki yang tetap. */
	stride: number;
	height: number;
	pose: Pose;
	/** Ketinggian lantai tempat ia berdiri — peron halte tidak setinggi trotoar. */
	base: number;
	/** Kelompok, supaya tiap kelompok bisa diskalakan sendiri oleh keramaian. */
	group: 'walk' | 'seat' | 'cafe' | 'halte';
}

/**
 * Arsiran diagonal 45°, digambar sekali lalu diulang. Periodenya membagi habis
 * sisi kanvas, jadi sambungan antar ubinnya tidak terlihat.
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
	#proposedMat!: THREE.MeshStandardMaterial;
	/** Garis dan arsiran petak sewa — warnanya dilawankan ke alas tiap jam. */
	#lotLineMats: Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial> = [];
	#hatchTex: THREE.CanvasTexture | null = null;
	/** Muka bangunan tempat papan pesaing boleh menempel. */
	#signSpots: { x: number; z: number; len: number }[] = [];

	#state: StreetState = { ...DEFAULT_STATE };
	#day: DaylightSample = daylightAt(12);
	#raf = 0;
	#running = false;
	#reduced: boolean;
	#lastWindowLevel = -1;
	#lastCrowdKey = '';
	/** Bingkai hanya digambar saat ini true. Adegan beku tidak butuh 60 fps. */
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
		// Penggunanya di ponsel Android kelas menengah dengan kuota data — piksel dan
		// peta bayangan penuh di layar sempit membakar baterai tanpa terlihat bedanya.
		const small = window.innerWidth < 768;
		this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
		this.#renderer.setClearAlpha(0);
		this.#renderer.shadowMap.enabled = true;
		this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.#shadowSize = small ? 1024 : 2048;
		this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.#renderer.toneMappingExposure = 1.0;

		// Langit adalah gradien CSS di belakang kanvas, bukan kubah di dalam adegan:
		// pada proyeksi ortografis semua sinar sejajar, jadi kubah langit hanya akan
		// menghasilkan satu warna rata. Kabut disetel ke warna horizon agar geometri
		// jauh larut tepat ke langit yang sama.
		this.#scene.fog = this.#fog;

		this.#camera = new THREE.OrthographicCamera(-40, 40, 30, -30, -200, 400);

		this.#buildLights();
		this.#buildBase();
		this.#buildRoad();
		this.#buildHalte();
		this.#buildBus();
		this.#buildBlocks();
		this.#buildCafe();
		this.#buildLot();
		this.#buildCrowd();

		this.applyState({});
		this.resize();
	}

	/* ── cahaya ───────────────────────────────────────────────────────────── */

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

	/* ── alas maket ───────────────────────────────────────────────────────── */

	#buildBase() {
		// Pelat alas dengan tebal yang terlihat — inilah yang memberitahu mata bahwa
		// ini benda di atas meja, bukan kota sungguhan yang dipotret dari helikopter.
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

		// Lajur busway mengapit median — TransJakarta memakai lajur terpisah di tengah.
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

		// tiang lampu
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

	/* ── halte TransJakarta ───────────────────────────────────────────────── */

	#buildHalte() {
		const g = new THREE.Group();
		const shell = new THREE.MeshStandardMaterial({ color: 0xe6e3dd, roughness: 0.8 });

		const platform = new THREE.Mesh(
			new THREE.BoxGeometry(HALTE_HALF * 2, HALTE_Y, HALTE_LEN),
			shell
		);
		platform.position.set(0, HALTE_Y / 2, HALTE_Z);
		platform.castShadow = true;
		platform.receiveShadow = true;
		g.add(platform);

		const roof = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.28, HALTE_LEN + 1.4), shell);
		roof.position.set(0, 3.9, HALTE_Z);
		roof.castShadow = true;
		g.add(roof);

		// dinding kaca setengah tinggi
		const glass = new THREE.MeshStandardMaterial({
			color: 0xd4d9dd,
			roughness: 0.25,
			metalness: 0.05,
			transparent: true,
			opacity: 0.55
		});
		for (const side of [-1, 1] as const) {
			const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.0, HALTE_LEN - 1.5), glass);
			wall.position.set(side * 2.55, 2.0, HALTE_Z);
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
				this.#place(side * 2.5, 2.4, HALTE_Z - 6.4 + k * 4.3);
				posts.setMatrixAt(i++, this.#dummy.matrix);
			}
		}
		posts.castShadow = true;
		g.add(posts);

		this.#scene.add(g);
	}

	/* ── bus TransJakarta (gandeng) ───────────────────────────────────────── */

	#buildBus() {
		const body = new THREE.MeshStandardMaterial({ color: 0xf0eee9, roughness: 0.55 });
		const glass = new THREE.MeshStandardMaterial({
			color: 0x9fa6ad,
			roughness: 0.2,
			metalness: 0.1
		});
		const tyre = new THREE.MeshStandardMaterial({ color: 0xa7a49e, roughness: 0.9 });

		// dua segmen + sambungan akordion: siluet bus gandeng yang khas
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

		// Sambungan akordion. Dibuat gelap dan kurus, dua segmennya terbaca sebagai
		// dua bus yang beriringan — jadi ia hanya sedikit lebih kurus dari bodinya,
		// dengan warna yang sama, dan panjangnya menutup penuh celah antar segmen.
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

		// Merapat di lajur sebelah peron, bukan menembusnya.
		this.#bus.position.set(-BUS_LANE_X, 0.1, 0);
		this.#scene.add(this.#bus);
	}

	/* ── blok bangunan sekitar ────────────────────────────────────────────── */

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

		// Dua deret per sisi. Deret belakang bukan hiasan: tanpanya, pita yang
		// dikosongkan untuk petak sewa menganga sampai tepi pelat dan blok ini
		// terbaca sebagai kota yang habis, bukan sebagai satu petak yang kosong.
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
					// Diuji dengan bentangnya, bukan titik tengahnya: blok selebar 16 m
					// yang titik tengahnya di luar pita tetap bisa menembusnya separuh.
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

		// Papan nama pesaing dipasang pada muka bangunan yang benar-benar ada, bukan
		// pada titik yang ditentukan sebelumnya — papan yang melayang di sela bangunan
		// akan terbaca sebagai kesalahan gambar. Yang terdekat dengan halte lebih dulu:
		// satu pesaing pun harus jatuh di tempat yang terlihat.
		this.#signSpots = boxes
			.filter((b) => b.front)
			.map((b) => ({
				x: b.x - b.side * (b.d / 2 + 0.06),
				z: b.z,
				// papan tidak boleh lebih panjang daripada mukanya sendiri
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

		// jendela: bidang kecil di muka yang menghadap jalan
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

		// Etalase lantai dasar — hanya pada deret depan. Etalase pada bangunan yang
		// berdiri di belakang blok lain tidak menghadap siapa-siapa.
		const fronts = boxes.filter((b) => b.front);
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

	/* ── kafe: pokok adegan ───────────────────────────────────────────────── */

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

		// muka kaca menghadap trotoar
		const front = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.1, 11.4), glass);
		front.position.set(CAFE_X - 5.55, 1.9, CAFE_Z);
		g.add(front);

		// tenda kanopi
		const awn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 12), trim);
		awn.position.set(CAFE_X - 6.7, 3.55, CAFE_Z);
		awn.rotation.z = 0.1;
		awn.castShadow = true;
		g.add(awn);

		// meja kursi di trotoar — inilah "keramaian kafe" yang dibaca mata
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

	/* ── petak yang bisa disewa ───────────────────────────────────────────── */

	#buildLot() {
		this.#proposedMat = new THREE.MeshStandardMaterial({
			color: 0xd8c3aa,
			transparent: true,
			opacity: 0.26,
			roughness: 0.6,
			emissive: 0x000000,
			// Tanpa ini, dua petak yang berurutan saling menghapus bergantung sudut
			// kamera — yang di belakang kadang tampak, kadang hilang.
			depthWrite: false
		});
		// Di maket arsitek, yang belum berdiri digariskan putus-putus dan yang sudah
		// berdiri digariskan penuh. Petak sewa memakai kedua konvensi itu sekaligus:
		// tapaknya nyata (garis penuh di tanah), massanya baru usulan (garis putus).
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

		// Arsiran diagonal: cara baku menandai petak kosong pada gambar kerja, dan
		// satu-satunya isyarat yang tetap terbaca saat maketnya gelap — bidang putih
		// tembus pandang saja hilang begitu matahari turun.
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
			// Wajib untuk garis putus-putus: tanpa jarak per ruas, garisnya tergambar penuh.
			edges.computeLineDistances();
			slot.add(edges);

			const ground = new THREE.LineSegments(padEdges, groundMat);
			ground.position.set(LOT_X, 0.06, z);
			slot.add(ground);

			this.#lotSlots.push(slot);
			this.#lotGroup.add(slot);
		}

		this.#scene.add(this.#lotGroup);

		// Gerai pesaing sejenis: papan kecil bertanda pada muka bangunan di sepanjang
		// jalan. Jumlah yang tampil mengikuti cacah pesaing yang benar-benar terdata.
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

	/* ── figur ────────────────────────────────────────────────────────────── */

	#buildCrowd() {
		const rnd = mulberry32(77712);

		// duduk di kursi kafe
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

		// berdiri & mengantre di depan kafe
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

		// menunggu di halte
		for (let i = 0; i < MAX_HALTE; i++) {
			this.#people.push({
				x: (rnd() - 0.5) * 3.6,
				z: HALTE_Z - HALTE_LEN / 2 + 1 + rnd() * (HALTE_LEN - 2),
				yaw: rnd() * Math.PI * 2,
				stride: 0,
				height: 0.9 + rnd() * 0.2,
				pose: 'stand',
				base: HALTE_Y,
				group: 'halte'
			});
		}

		// berjalan di trotoar, dibekukan tengah langkah
		for (let i = 0; i < MAX_WALKERS; i++) {
			const side = rnd() < 0.5 ? -1 : 1;
			const inner = rnd() < 0.5;
			this.#people.push({
				x: side * (ROAD_HALF + (inner ? 1.3 : 3.1)) + (rnd() - 0.5) * 1.3,
				z: -46 + rnd() * 92,
				yaw: rnd() < 0.5 ? 0 : Math.PI,
				// setiap orang punya sudut kaki sendiri: barisan yang membeku serempak
				// akan terbaca sebagai pola, bukan sebagai kerumunan
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

	/** Dipahat ulang hanya saat keramaian berubah — bukan tiap bingkai. */
	#layoutCrowd() {
		const d = this.#state.nodata ? 0 : Math.max(0, Math.min(1, this.#state.density));
		const key = `${d.toFixed(3)}|${this.#state.nodata}`;
		if (key === this.#lastCrowdKey) return;
		this.#lastCrowdKey = key;

		// tiap kelompok terisi menurut porsinya sendiri
		const quota: Record<Person['group'], number> = {
			seat: Math.round(MAX_SEATED * d),
			cafe: Math.round(MAX_CAFE_STAND * d),
			halte: Math.round(MAX_HALTE * d),
			walk: Math.round(MAX_WALKERS * d)
		};
		const used: Record<Person['group'], number> = { seat: 0, cafe: 0, halte: 0, walk: 0 };
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
				// duduk: paha maju mendatar; berjalan: kaki terbuka pada sudut tetap
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

	/* ── keadaan ──────────────────────────────────────────────────────────── */

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

		if (Math.abs(d.windowLights - this.#lastWindowLevel) > 0.012) {
			this.#lastWindowLevel = d.windowLights;
			this.#paintLights(d);
		}

		const tint = CATEGORY_TINT[this.#state.category] ?? CATEGORY_TINT.kopi;
		this.#proposedMat.color.setHex(tint);
		this.#proposedMat.emissive.setHex(tint);
		this.#proposedMat.emissiveIntensity = d.windowLights * 0.45;
		// Nol ruang disewakan berarti nol petak yang tampil — bukan satu petak contoh.
		const shown = this.#state.nodata ? 0 : Math.max(0, Math.min(LOT_SLOTS.length, Math.round(this.#state.vacancies)));
		this.#lotSlots.forEach((slot, i) => (slot.visible = i < shown));
		this.#lotGroup.visible = shown > 0;

		const rivals = this.#state.nodata
			? 0
			: Math.max(0, Math.min(this.#signSpots.length, Math.round(this.#state.rivals)));
		this.#rivalMarks.count = rivals;
		(this.#rivalMarks.material as THREE.MeshStandardMaterial).color.setHex(tint);

		// Garis petak selalu harus melawan alasnya: putih di atas maket yang gelap,
		// gelap di atas maket yang tersorot tengah hari. Dipatok putih saja, justru
		// hilang tepat pada jam yang paling ingin ditunjukkan.
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

		const m = this.#shopfronts.count;
		for (let i = 0; i < m; i++) {
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

		// Orbit isometrik pendek: sudut pandang tetap miring, hanya berputar sedikit
		// dan merapat ke kafe. Sudut yang berubah drastis akan merusak bacaan denah.
		const azim = Math.PI * (0.72 + e * 0.1);
		const elev = 0.62 - e * 0.1;
		// Pada kamera ortografis, jarak tidak mengubah skala sama sekali — tapi kabut
		// dihitung dari jarak ke kamera. Dipasang jauh (dulu 120 m), seluruh adegan
		// berkabut rata dan maketnya jadi susu; dipasang tepat di luar blok, kabut
		// kembali bekerja sebagaimana mestinya: yang jauh larut, yang dekat bening.
		const dist = 32;

		// Titik pandang dikunci pada gugus yang jadi pokok cerita — halte, kafe, dan
		// petak kosong di sebelahnya — lalu merapat ke muka kafe. Membingkai blok
		// secara umum membuat ketiganya mengecil dan tak satu pun terbaca.
		const cx = 8 + e * 6;
		const cz = 2 - e * 4;

		this.#camera.position.set(
			cx + Math.cos(azim) * Math.cos(elev) * dist,
			Math.sin(elev) * dist,
			cz + Math.sin(azim) * Math.cos(elev) * dist
		);
		this.#camera.lookAt(cx, 3, cz);

		// "Zoom" pada kamera ortografis adalah lebar frustum, bukan jarak.
		// Dibuka jauh: seluruh pelat maket muat di layar lebar, tepinya kelihatan, dan
		// mata langsung membaca "benda di atas meja". Baru kemudian merapat ke kafe.
		this.#viewWidth = 118 - e * 68;
		this.#applyFrustum();

		// Bus merapat ke halte seiring gulir — satu-satunya benda yang benar-benar
		// berpindah, jadi mata langsung tahu ke mana harus melihat.
		this.#bus.position.z = 31 - e * 31;
	}

	#viewWidth = 118;

	#applyFrustum() {
		const w = this.#canvas.clientWidth || 1;
		const h = this.#canvas.clientHeight || 1;
		const aspect = w / h;

		// Pada layar potret, membagi lebar tetap dengan rasio menghasilkan bentang
		// vertikal raksasa: maketnya menyusut jadi pita di tengah, sisanya langit dan
		// alas kosong. Jadi bentang tegaknya dibatasi, dan layar sempit merapat
		// (memotong ke samping) alih-alih menjauh.
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

	/**
	 * Adegannya beku, jadi loop ini bukan animasi: ia hanya menunggu keadaan
	 * berubah. Bingkai digambar saat ada yang berubah, selebihnya GPU menganggur.
	 */
	start() {
		if (this.#running) return;
		if (this.#reduced) {
			this.renderOnce();
			return;
		}
		this.#running = true;
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
