import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Ship the pinned local library with the static mockup, without a CDN dependency.
const require = createRequire(import.meta.url);
const target = new URL('../public/mockups/vendor/', import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(require.resolve('jspdf/dist/jspdf.umd.min.js'), new URL('jspdf.umd.min.js', target));
