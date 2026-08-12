import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// maplibre-gl loads its own worker over a relative URL. If the package is
	// prebundled, the worker file is not copied along; if it is not, the dev server
	// injects its HMR client into the worker file and the worker dies on start.
	// Both end the same way: the GeoJSON source hangs without a single error message.
	// The way out: bundle the worker ourselves via `?worker&url` (see MapView).
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
