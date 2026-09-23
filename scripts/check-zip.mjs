import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

const archive = unzipSync(new Uint8Array(await readFile(new URL('../gitlab-fast-pipe.zip', import.meta.url))));
const required = ['manifest.json', 'background.js', 'content.js', 'content.css', 'icons/128.png'];
for (const path of required) {
  if (!archive[path]) throw new Error(`Missing archive entry: ${path}`);
}

const manifest = JSON.parse(strFromU8(archive['manifest.json']));
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (manifest.version !== packageJson.version || manifest.manifest_version !== 3) {
  throw new Error('ZIP manifest has an unexpected version.');
}
if (Object.keys(archive).some((path) => path.includes('..') || path.endsWith('.map'))) {
  throw new Error('ZIP contains an unsafe path or source map.');
}
console.log(`Verified ${Object.keys(archive).length} extension files for version ${manifest.version}.`);
