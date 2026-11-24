import { createRequire } from 'node:module';
const applicationRequire = createRequire(new URL('../../application/package.json', import.meta.url));
const { build } = createRequire(applicationRequire.resolve('vite'))('esbuild');
import { fileURLToPath } from 'node:url';
await build({entryPoints:[fileURLToPath(new URL('./worker.mjs', import.meta.url))],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:fileURLToPath(new URL('./deploy-worker.mjs',import.meta.url))});
