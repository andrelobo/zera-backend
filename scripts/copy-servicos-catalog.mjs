import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourcePath = resolve(projectRoot, 'servicos_lc116_v2.json');
const distDir = resolve(projectRoot, 'dist');
const destPath = resolve(distDir, 'servicos_lc116_v2.json');

if (!existsSync(sourcePath)) {
  throw new Error(`Catalog source file not found: ${sourcePath}`);
}

mkdirSync(distDir, { recursive: true });
copyFileSync(sourcePath, destPath);

console.log(`[copy-servicos-catalog] Copied ${sourcePath} -> ${destPath}`);
