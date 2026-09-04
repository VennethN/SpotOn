/**
 * The contract every 3D scene in SpotOn fulfils.
 *
 * There are two scenes today — the street diorama and the hexagon grid — and both
 * need exactly the same handling: loaded dynamically, paused when off screen,
 * following their container's size, and cleaned up on the way out. This contract is
 * what lets that handling be written once in `ui/SceneCanvas` instead of copied per
 * scene.
 */
export interface SceneWorld {
	/** Applies a partial state; the scene itself knows what it means. */
	applyState(partial: Record<string, unknown>): void;
	/** Start drawing. A static scene may draw only when something changes. */
	start(): void;
	stop(): void;
	resize(): void;
	dispose(): void;
}

export interface WorldOptions {
	reducedMotion?: boolean;
}

export type WorldFactory = (canvas: HTMLCanvasElement, opts: WorldOptions) => SceneWorld;
