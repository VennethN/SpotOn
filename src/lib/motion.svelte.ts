import { browser } from '$app/environment';

/**
 * Pegas yang diparameterkan seperti pada perkakas desain Apple: rasio redaman
 * (seberapa banyak lonjakan) dan response (seberapa cepat mencapai target dalam
 * detik) — bukan massa/kekakuan/redaman fisik.
 *
 * Sifat yang penting: pegas selalu bergerak dari nilai yang SEDANG tampil, dan
 * kecepatan ikut terbawa saat target berubah di tengah jalan. Itulah yang membuat
 * animasi bisa direbut dan dibalik kapan saja tanpa lompatan.
 */
export type SpringOptions = {
	/** 1 = kritis (tanpa lonjakan). < 1 memantul. */
	damping?: number;
	/** detik menuju target; makin kecil makin sigap. */
	response?: number;
	/** ambang berhenti, dalam satuan nilai. */
	epsilon?: number;
};

const DEFAULTS: Required<SpringOptions> = { damping: 1, response: 0.4, epsilon: 0.0005 };

export function prefersReducedMotion(): boolean {
	return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Nilai pegas berbasis rune. Baca `.current` di markup; setel `.target` untuk
 * menganimasikan; panggil `.snap()` untuk memindahkan tanpa gerak (dipakai saat
 * jari sedang menyeret — di sana umpan balik harus 1:1, bukan dipegasi).
 */
export class SpringValue {
	current = $state(0);
	#velocity = 0;
	#target: number;
	#opts: Required<SpringOptions>;
	#raf = 0;
	#last = 0;

	constructor(initial = 0, opts: SpringOptions = {}) {
		this.current = initial;
		this.#target = initial;
		this.#opts = { ...DEFAULTS, ...opts };
	}

	get target() {
		return this.#target;
	}

	get velocity() {
		return this.#velocity;
	}

	/** Animasikan ke `value`. `velocity` menyambung kecepatan gestur agar tidak ada jahitan. */
	to(value: number, velocity?: number) {
		this.#target = value;
		if (velocity !== undefined) this.#velocity = velocity;
		if (!browser || prefersReducedMotion()) {
			this.#stop();
			this.current = value;
			this.#velocity = 0;
			return;
		}
		if (!this.#raf) {
			this.#last = performance.now();
			this.#raf = requestAnimationFrame(this.#tick);
		}
	}

	/** Pindahkan seketika (tracking 1:1 selama gestur). */
	snap(value: number, velocity = 0) {
		this.#stop();
		this.#target = value;
		this.current = value;
		this.#velocity = velocity;
	}

	configure(opts: SpringOptions) {
		this.#opts = { ...this.#opts, ...opts };
	}

	destroy() {
		this.#stop();
	}

	#stop() {
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.#raf = 0;
	}

	#tick = (now: number) => {
		// Batasi dt agar tab yang kembali aktif tidak meledakkan integrasi.
		const dt = Math.min(0.064, (now - this.#last) / 1000);
		this.#last = now;

		const { damping: zeta, response, epsilon } = this.#opts;
		const omega = (2 * Math.PI) / response;
		const dx = this.current - this.#target;
		// pegas teredam: a = -ω²·x - 2ζω·v, diintegrasikan semi-implisit
		const accel = -omega * omega * dx - 2 * zeta * omega * this.#velocity;
		this.#velocity += accel * dt;
		this.current += this.#velocity * dt;

		const settled =
			Math.abs(this.current - this.#target) < epsilon && Math.abs(this.#velocity) < epsilon * 8;
		if (settled) {
			this.current = this.#target;
			this.#velocity = 0;
			this.#raf = 0;
			return;
		}
		this.#raf = requestAnimationFrame(this.#tick);
	};
}

/**
 * Titik istirahat yang diproyeksikan dari kecepatan lepas — bentuk peluruhan
 * eksponensial yang dipakai iOS, bukan v²/2a dari buku teks. Dipakai untuk memilih
 * titik snap ke arah lemparan, bukan ke titik lepas.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
	return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Perlawanan progresif di luar batas: melambat, tidak membeku. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
	return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Riwayat pointer pendek → kecepatan lepas (px/detik). */
export class VelocityTracker {
	#samples: Array<{ v: number; t: number }> = [];

	add(value: number, time = performance.now()) {
		this.#samples.push({ v: value, t: time });
		if (this.#samples.length > 6) this.#samples.shift();
	}

	reset() {
		this.#samples = [];
	}

	/** Kecepatan rata-rata pada ~100 ms terakhir. */
	velocity(): number {
		const s = this.#samples;
		if (s.length < 2) return 0;
		const last = s[s.length - 1];
		let first = s[0];
		for (let i = s.length - 1; i >= 0; i--) {
			if (last.t - s[i].t > 100) break;
			first = s[i];
		}
		const dt = last.t - first.t;
		if (dt <= 0) return 0;
		return ((last.v - first.v) / dt) * 1000;
	}
}
