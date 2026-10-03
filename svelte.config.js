import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFile, writeFile } from 'node:fs/promises';
const bunAdapter = adapter();
export default {
	preprocess: vitePreprocess(),
	kit: {
		csrf: { trustedOrigins: [] },
		adapter: {
			...bunAdapter,
			async adapt(builder) {
				await bunAdapter.adapt(builder);
				// Adapter 1.0.1 force-closes requests. Drain them before closing the DB pool.
				const path = 'build/index.js';
				const source = await readFile(path, 'utf8');
				const original = 'process.emit("sveltekit:shutdown", reason);\n  await server.stop(true);';
				if (!source.includes(original))
					throw new Error('Adapter shutdown source changed; review drain patch before building.');
				await writeFile(
					path,
					source.replace(
						original,
						'await server.stop(false);\n  process.emit("sveltekit:shutdown", reason);'
					)
				);
			}
		}
	}
};
