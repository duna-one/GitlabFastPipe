import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';

const dist = new URL('../dist/', import.meta.url);
const rootPath = fileURLToPath(new URL('../', import.meta.url));
const distPath = fileURLToPath(dist);
const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

if (manifest.version !== packageJson.version) {
  throw new Error('Manifest and package versions differ.');
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('icons/', dist), { recursive: true });

await Promise.all([
  build({ entryPoints: [join(rootPath, 'src/background.ts')], outfile: join(distPath, 'background.js'), bundle: true, platform: 'browser', format: 'esm', target: 'chrome120', minify: true }),
  build({ entryPoints: [join(rootPath, 'src/content/index.ts')], outfile: join(distPath, 'content.js'), bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', minify: true })
]);

await writeFile(new URL('manifest.json', dist), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(new URL('../extension/content.css', import.meta.url), new URL('content.css', dist));

for (const size of [16, 32, 48, 128]) {
  await sharp(fileURLToPath(new URL('../extension/icon.svg', import.meta.url))).resize(size, size).png().toFile(fileURLToPath(new URL(`icons/${size}.png`, dist)));
}
