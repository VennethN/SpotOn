import { getContext, setContext } from 'svelte';
import { CATEGORY_MAP } from '$lib/domain/categories';
import { scoreAcrossCategories, scoreAll } from '$lib/domain/scoring';
import { DEFAULT_WEIGHTS } from '$lib/domain/weights';
import { applyTheme, storedTheme, watchSystemDark, type Theme } from './theme.svelte';
import type { AiAnswer, Hex, CategoryKey, ScoredHex, Weights } from '$lib/types';

export type LayerKey = 'score' | 'rute' | 'poi' | 'nodata' | 'label';
export type { Theme };

const KEY = Symbol('spoton');

/**
 * Status antarmuka SpotOn.
 *
 * Skoring dihitung ulang di klien setiap kali bobot berubah supaya slider terasa
 * seketika — memutar bobot lewat jaringan akan memasang latensi tepat di jalur
 * masukan. Mesin skornya modul yang sama persis dengan yang dipakai server
 * (`$lib/scoring`), jadi tidak ada dua versi kebenaran.
 */
export class AppState {
	catchments = $state<Hex[]>([]);
	category = $state<CategoryKey>('kopi');
	weights = $state<Weights>({ ...DEFAULT_WEIGHTS });
	layers = $state<Record<LayerKey, boolean>>({
		score: true,
		rute: true,
		poi: false,
		nodata: true,
		label: true
	});
	selectedId = $state<string | null>(null);
	highlight = $state<string[]>([]);
	ai = $state<AiAnswer | null>(null);
	aiLoading = $state(false);
	aiError = $state<string | null>(null);
	theme = $state<Theme>('system');
	/** Preferensi gelap sistem, dipantau agar tema efektif ikut reaktif. */
	systemDark = $state(false);
	/** Panel yang sedang tampil pada tata letak ringkas. */
	sheetTab = $state<'rekomendasi' | 'detail' | 'tabel' | 'kontrol'>('rekomendasi');
	tableOpen = $state(false);

	constructor(catchments: Hex[]) {
		this.catchments = catchments;
	}

	get definition() {
		return CATEGORY_MAP[this.category];
	}

	/** Seluruh catchment yang sudah diskor untuk kategori aktif. */
	get rows(): ScoredHex[] {
		return scoreAll(this.catchments, this.category, this.weights);
	}

	get selected(): ScoredHex | null {
		return this.rows.find((r) => r.id === this.selectedId) ?? null;
	}

	/** Peluang catchment terpilih di seluruh kategori — untuk membandingkan format usaha. */
	get selectedAcrossCategories() {
		if (!this.selectedId) return [];
		return scoreAcrossCategories(this.catchments, this.selectedId, this.weights);
	}

	get coverage() {
		const rows = this.rows;
		const terdata = rows.filter((r) => !r.nodata);
		return {
			total: rows.length,
			terdata: terdata.length,
			belumTerdata: rows.length - terdata.length,
			titikMisi: terdata.reduce((a, r) => a + r.nTot, 0),
			poi: rows.reduce((a, r) => a + r.osm, 0)
		};
	}

	select(id: string | null) {
		this.selectedId = id;
		if (id) this.sheetTab = 'detail';
	}

	setCategory(cat: CategoryKey) {
		this.category = cat;
		this.highlight = [];
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		applyTheme(theme);
	}

	/** Tema efektif setelah preferensi sistem diperhitungkan. */
	get resolvedTheme(): 'light' | 'dark' {
		if (this.theme !== 'system') return this.theme;
		return this.systemDark ? 'dark' : 'light';
	}

	/** Memulihkan pilihan tema dan memantau preferensi sistem. Mengembalikan pembersihnya. */
	initTheme(): () => void {
		this.theme = storedTheme();
		return watchSystemDark((dark) => (this.systemDark = dark));
	}

	/** Bertanya ke mesin rekomendasi (endpoint server). */
	async ask(question: string) {
		this.aiLoading = true;
		this.aiError = null;
		try {
			const res = await fetch('/api/ai/query', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					question,
					kategori: this.category,
					weights: this.weights
				})
			});
			if (!res.ok) throw new Error(`Gagal memproses pertanyaan (${res.status}).`);
			const data: AiAnswer = await res.json();
			this.ai = data;
			this.highlight = data.highlight;
			// Query hasil parsing boleh mengubah kategori aktif — peta harus ikut pindah
			// ke kategori yang benar-benar dijawab, bukan tetap di kategori sebelumnya.
			if (data.query.kategori !== this.category) this.category = data.query.kategori;
		} catch (err) {
			this.aiError = err instanceof Error ? err.message : 'Terjadi kesalahan.';
		} finally {
			this.aiLoading = false;
		}
	}
}

export function setAppState(catchments: Hex[]): AppState {
	return setContext(KEY, new AppState(catchments));
}

export function getAppState(): AppState {
	return getContext<AppState>(KEY);
}
