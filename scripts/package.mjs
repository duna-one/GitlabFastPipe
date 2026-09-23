import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);
const entries = {};

/** <summary>Collects built extension files under safe relative archive paths.</summary> */
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
    } else if (entry.isFile()) {
      const archivePath = relative(distPath, fullPath).replaceAll('\\', '/');
      entries[archivePath] = new Uint8Array(await readFile(fullPath));
    }
  }
}

await collect(distPath);
if (!entries['manifest.json'] || !entries['content.js'] || !entries['background.js']) {
  throw new Error('Build output is incomplete. Run npm run build first.');
}
await writeFile(new URL('../gitlab-fast-pipe.zip', import.meta.url), zipSync(entries, { level: 9 }));
