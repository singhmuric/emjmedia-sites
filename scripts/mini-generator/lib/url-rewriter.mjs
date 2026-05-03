import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const SOURCE_HOST = 'kfz-demo.emj-media.de';

const BINARY_EXTS = new Set([
  '.avif',
  '.webp',
  '.woff',
  '.woff2',
  '.png',
  '.jpg',
  '.jpeg',
  '.ico',
]);

export function rewriteUrlsInFolder(rootDir, slug) {
  const targetHost = `${slug}.emj-media.de`;
  const re = new RegExp(SOURCE_HOST.replace(/\./g, '\\.'), 'g');

  // Node 20.12+: readdirSync({recursive:true,withFileTypes:true})
  // returns Dirents with parentPath. Built-in covers what `glob` would.
  const entries = readdirSync(rootDir, { recursive: true, withFileTypes: true });
  const touched = [];

  for (const dirent of entries) {
    if (!dirent.isFile()) continue;
    if (BINARY_EXTS.has(extname(dirent.name).toLowerCase())) continue;

    const parent = dirent.parentPath ?? dirent.path ?? rootDir;
    const fullPath = join(parent, dirent.name);

    const before = readFileSync(fullPath, 'utf8');
    if (!before.includes(SOURCE_HOST)) continue;
    const after = before.replace(re, targetHost);
    writeFileSync(fullPath, after, 'utf8');
    touched.push(fullPath);
  }

  return { targetHost, filesTouched: touched };
}
