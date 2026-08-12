/**
 * Kontrak yang dipenuhi tiap adegan tiga dimensi di SpotOn.
 *
 * Ada dua adegan sekarang — maket jalan dan kisi heksagon — dan keduanya butuh
 * urusan yang sama persis: dimuat dinamis, berhenti saat di luar layar, ikut
 * ukuran wadahnya, dan dibersihkan saat pergi. Kontrak ini yang membuat urusan
 * itu bisa ditulis sekali di `ui/SceneCanvas`, bukan disalin per adegan.
 */
export interface SceneWorld {
	/** Menerapkan sebagian keadaan; adegan sendiri yang tahu apa artinya. */
	applyState(partial: Record<string, unknown>): void;
	/** Mulai menggambar. Adegan beku boleh hanya menggambar saat ada perubahan. */
	start(): void;
	stop(): void;
	resize(): void;
	dispose(): void;
}

export interface WorldOptions {
	reducedMotion?: boolean;
}

export type WorldFactory = (canvas: HTMLCanvasElement, opts: WorldOptions) => SceneWorld;
