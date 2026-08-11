import { formatHour } from '$lib/utils/format';

/**
 * Model cahaya 24 jam untuk Jakarta (−6.2° LU, praktis di khatulistiwa: matahari
 * terbit ~05:50 dan terbenam ~18:00 sepanjang tahun, dan lewat nyaris tepat di
 * atas kepala saat tengah hari).
 *
 * Satu-satunya sumber kebenaran untuk warna adegan 3D **dan** warna halaman —
 * keduanya membaca sampel yang sama, sehingga tipografi di atas adegan tidak
 * pernah lepas dari langitnya.
 *
 * Sengaja tidak bergantung pada three.js: dipakai juga oleh CSS.
 */

export type Phase = 'malam' | 'subuh' | 'pagi' | 'siang' | 'sore' | 'senja';

export interface DaylightSample {
	/** 0..24, boleh pecahan. */
	hour: number;
	/** Radian di atas horizon; negatif berarti matahari sudah terbenam. */
	sunElevation: number;
	sunAzimuth: number;
	sunColor: string;
	sunIntensity: number;
	skyTop: string;
	skyHorizon: string;
	ambientColor: string;
	ambientIntensity: number;
	fogColor: string;
	fogDensity: number;
	/** 0..1 — lampu jalan menyala. */
	streetLights: number;
	/** 0..1 — etalase & jendela menyala. */
	windowLights: number;
	groundColor: string;
	/** Warna teks di atas adegan — selalu terang, di atas scrim gelap. */
	ink: string;
	inkMuted: string;
	/** Kebalikannya, untuk tombol pejal: tinta gelap di atas bidang terang. */
	inkInverse: string;
	/** Lapisan gelap di bawah teks; makin terang langit makin tebal. */
	scrim: number;
	phase: Phase;
	/** Label bahasa manusia, mis. "senja · 18:20". */
	label: string;
}

interface Key {
	h: number;
	skyTop: string;
	skyHorizon: string;
	sun: string;
	sunI: number;
	amb: string;
	ambI: number;
	fog: string;
	fogD: number;
	street: number;
	window: number;
	ground: string;
	dark: boolean;
}

/* Kunci warna sepanjang hari. Jakarta lembap — horizon selalu berkabut, tidak
   pernah biru bersih, dan malamnya jingga karena lampu natrium memantul di uap. */
const KEYS: Key[] = [
	{
		h: 0,
		skyTop: '#04060f',
		skyHorizon: '#0d1226',
		sun: '#243050',
		sunI: 0.0,
		amb: '#1b2340',
		ambI: 0.66,
		fog: '#090d1c',
		fogD: 0.0115,
		street: 1,
		window: 0.3,
		ground: '#15182a',
		dark: true
	},
	{
		h: 4.6,
		skyTop: '#0a1128',
		skyHorizon: '#26294a',
		sun: '#3a4468',
		sunI: 0.0,
		amb: '#2b3357',
		ambI: 0.92,
		fog: '#141a33',
		fogD: 0.0125,
		street: 1,
		window: 0.22,
		ground: '#1b2038',
		dark: true
	},
	{
		h: 5.9,
		skyTop: '#2b4372',
		skyHorizon: '#e28f5e',
		sun: '#ff9d5c',
		sunI: 1.40,
		amb: '#6b6f8e',
		ambI: 1.00,
		fog: '#9a8478',
		fogD: 0.0135,
		street: 0.55,
		window: 0.16,
		ground: '#4a4348',
		dark: false
	},
	{
		h: 7.6,
		skyTop: '#5286c8',
		skyHorizon: '#c3d9ee',
		sun: '#ffe6bd',
		sunI: 3.40,
		amb: '#9fb4cd',
		ambI: 1.20,
		fog: '#d5dade',
		fogD: 0.0050,
		street: 0,
		window: 0.05,
		ground: '#8e8f92',
		dark: false
	},
	{
		h: 12,
		skyTop: '#4a86d4',
		skyHorizon: '#d6e6f4',
		sun: '#fff8ec',
		sunI: 4.30,
		amb: '#b9c9da',
		ambI: 1.40,
		fog: '#dfe3e6',
		fogD: 0.0042,
		street: 0,
		window: 0.03,
		ground: '#9a9b9e',
		dark: false
	},
	{
		h: 15.8,
		skyTop: '#6098d2',
		skyHorizon: '#e6ddca',
		sun: '#ffdda4',
		sunI: 3.60,
		amb: '#b3bccb',
		ambI: 1.30,
		fog: '#dcdccf',
		fogD: 0.0052,
		street: 0,
		window: 0.06,
		ground: '#94908c',
		dark: false
	},
	{
		h: 17.9,
		skyTop: '#31406f',
		skyHorizon: '#ff7f45',
		sun: '#ff8746',
		sunI: 1.85,
		amb: '#7a6a78',
		ambI: 1.00,
		fog: '#b9714f',
		fogD: 0.0112,
		street: 0.45,
		window: 0.42,
		ground: '#4e4148',
		dark: false
	},
	{
		h: 18.9,
		skyTop: '#141d3d',
		skyHorizon: '#7a4159',
		sun: '#6d3a55',
		sunI: 0.12,
		amb: '#3f3f60',
		ambI: 1.0,
		fog: '#3a2a3c',
		fogD: 0.0128,
		street: 1,
		window: 0.88,
		ground: '#282536',
		dark: true
	},
	{
		h: 20.5,
		skyTop: '#060a18',
		skyHorizon: '#141a30',
		sun: '#243050',
		sunI: 0.0,
		amb: '#20284a',
		ambI: 0.76,
		fog: '#0c1122',
		fogD: 0.0118,
		street: 1,
		window: 0.72,
		ground: '#191d2e',
		dark: true
	},
	{
		h: 24,
		skyTop: '#04060f',
		skyHorizon: '#0d1226',
		sun: '#243050',
		sunI: 0.0,
		amb: '#1b2340',
		ambI: 0.66,
		fog: '#090d1c',
		fogD: 0.0115,
		street: 1,
		window: 0.3,
		ground: '#15182a',
		dark: true
	}
];

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
	const c = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
	return '#' + ((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1);
}

/** Campur di ruang gamma-terkoreksi — mencampur sRGB mentah membuat senja jadi lumpur. */
function mixHex(a: string, b: string, t: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const lin = (v: number) => Math.pow(v / 255, 2.2);
	const out = (v: number) => Math.pow(v, 1 / 2.2) * 255;
	return rgbToHex(
		out(lin(ar) + (lin(br) - lin(ar)) * t),
		out(lin(ag) + (lin(bg) - lin(ag)) * t),
		out(lin(ab) + (lin(bb) - lin(ab)) * t)
	);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Relatif luminance sRGB — dipakai untuk memilih tinta yang kontras. */
function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	const f = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function phaseOf(h: number): Phase {
	if (h < 4.4) return 'malam';
	if (h < 6.2) return 'subuh';
	if (h < 10.5) return 'pagi';
	if (h < 15.2) return 'siang';
	if (h < 17.6) return 'sore';
	if (h < 19.2) return 'senja';
	return 'malam';
}

export function daylightAt(hour: number): DaylightSample {
	const h = ((hour % 24) + 24) % 24;

	let i = 0;
	while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
	const a = KEYS[i];
	const b = KEYS[i + 1];
	const span = b.h - a.h;
	const t = span <= 0 ? 0 : (h - a.h) / span;

	const skyTop = mixHex(a.skyTop, b.skyTop, t);
	const skyHorizon = mixHex(a.skyHorizon, b.skyHorizon, t);
	const fogColor = mixHex(a.fog, b.fog, t);

	// Matahari khatulistiwa: puncak nyaris di zenit, terbit 05:50 terbenam 18:00.
	const dayFrac = (h - 5.85) / (18.0 - 5.85);
	// Dipangkas di ~58°, bukan 85° yang sebenarnya. Matahari tepat di atas kepala
	// secara fisika benar untuk khatulistiwa, tapi menghapus seluruh bayangan dan
	// maket putih jadi rata tanpa bentuk. Cahaya menyerong dipertahankan sepanjang hari.
	const sunElevation = Math.sin(dayFrac * Math.PI) * 1.02;
	// Melintas dari timur ke barat; sedikit condong ke utara.
	const sunAzimuth = Math.PI * (0.18 + dayFrac * 1.04);

	const luma = luminance(skyHorizon) * 0.45 + luminance(skyTop) * 0.55;
	const dayish = Math.max(0, Math.min(1, (luma - 0.05) / 0.3));

	return {
		hour: h,
		sunElevation,
		sunAzimuth,
		sunColor: mixHex(a.sun, b.sun, t),
		sunIntensity: lerp(a.sunI, b.sunI, t),
		skyTop,
		skyHorizon,
		ambientColor: mixHex(a.amb, b.amb, t),
		ambientIntensity: lerp(a.ambI, b.ambI, t),
		fogColor,
		fogDensity: lerp(a.fogD, b.fogD, t),
		streetLights: lerp(a.street, b.street, t),
		windowLights: lerp(a.window, b.window, t),
		groundColor: mixHex(a.ground, b.ground, t),
		// Teks selalu terang di atas scrim gelap — seperti judul film di atas gambar:
		// satu perlakuan yang terbaca pada tengah hari maupun tengah malam. Tintanya
		// tetap diambil dari langitnya sendiri, tidak pernah abu-abu netral.
		ink: mixHex('#ffffff', skyHorizon, 0.06),
		inkMuted: mixHex('#ffffff', skyHorizon, 0.3),
		inkInverse: mixHex('#0e1118', skyTop, 0.12),
		// Siang butuh scrim lebih tebal justru karena adegannya terang — tapi
		// scrim-nya sempit, hanya di bawah teks; adegan tidak boleh ikut diredam.
		scrim: lerp(0.26, 0.52, dayish),
		phase: phaseOf(h),
		label: `${phaseOf(h)} · ${formatHour(h)}`
	};
}

/** Jam lokal mesin sebagai pecahan (mis. 18.35). */
export function localHour(now = new Date()): number {
	return now.getHours() + now.getMinutes() / 60;
}
