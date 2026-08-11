import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// maplibre-gl memuat worker-nya sendiri lewat URL relatif. Kalau paketnya ikut
	// di-prebundle, berkas worker tidak ikut disalin; kalau tidak, dev server justru
	// menyuntikkan klien HMR ke dalam berkas worker sehingga worker mati saat start.
	// Keduanya berakhir sama: sumber GeoJSON menggantung tanpa satu pun pesan galat.
	// Jalan keluarnya: worker di-bundle sendiri lewat `?worker&url` (lihat MapView).
	optimizeDeps: { exclude: ['maplibre-gl'] },
	worker: { format: 'es' },
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	]
});
