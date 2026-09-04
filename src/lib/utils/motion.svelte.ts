import { browser } from '$app/environment';

/**
 * A spring parameterised the way Apple's design tools do it: a damping ratio (how
 * much overshoot) and a response (how quickly it reaches the target, in seconds) —
 * not physical mass/stiffness/damping.
 *
 * The property that matters: the spring always moves from the value CURRENTLY on
 * screen, and its velocity carries over when the target changes mid-flight. That is
 * what lets an animation be interrupted and reversed at any moment without a jump.
 */
export type SpringOptions = {
	/** 1 = critically damped (no overshoot). < 1 bounces. */
	damping?: number;
	/** seconds to the target; smaller is snappier. */
	response?: number;
	/** settle threshold, in units of the value. */
	epsilon?: number;
};

const DEFAULTS: Required<SpringOptions> = { damping: 1, response: 0.4, epsilon: 0.0005 };

export function prefersReducedMotion(): boolean {
	return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A rune-based spring value. Read `.current` in markup; set `.target` to animate;
 * call `.snap()` to move without motion (used while a finger is dragging — there
 * the feedback has to be 1:1, not sprung).
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

	/** Animate to `value`. `velocity` carries the gesture's speed over so there is no seam. */
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

	/** Move instantly (1:1 tracking during a gesture). */
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
		// Cap dt so a tab coming back to life does not blow up the integration.
		const dt = Math.min(0.064, (now - this.#last) / 1000);
		this.#last = now;

		const { damping: zeta, response, epsilon } = this.#opts;
		const omega = (2 * Math.PI) / response;
		const dx = this.current - this.#target;
		// damped spring: a = -ω²·x - 2ζω·v, integrated semi-implicitly
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
 * The resting point projected from the release velocity — the exponential-decay
 * form iOS uses, not the textbook v²/2a. Used to pick the snap point in the
 * direction of the throw, rather than at the point of release.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
	return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past the edge: it slows down, it does not freeze. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
	return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** A short pointer history → the release velocity (px/second). */
export class VelocityTracker {
	#samples: Array<{ v: number; t: number }> = [];

	add(value: number, time = performance.now()) {
		this.#samples.push({ v: value, t: time });
		if (this.#samples.length > 6) this.#samples.shift();
	}

	reset() {
		this.#samples = [];
	}

	/** Average velocity over the last ~100 ms. */
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
