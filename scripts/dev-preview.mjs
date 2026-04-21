#!/usr/bin/env node
// Local dev preview server. Plan §11.2.
// Serves sites/onepages/{slug}/ on http://localhost:4000/{slug}/
// Subdomain emulation: also accepts Host: {slug}.localhost — strips the suffix.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ONEPAGES = resolve(ROOT, 'sites/onepages');
const PORT = Number(process.env.PORT ?? 4000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function detectSlug(req) {
  const host = (req.headers.host ?? '').split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    const stripped = host.replace(/\.localhost$/i, '');
    if (stripped !== host) return { slug: stripped, urlPath: req.url || '/' };
  }
  const m = (req.url || '/').match(/^\/([a-z0-9-]+)(\/.*)?$/i);
  if (m) {
    const slug = m[1];
    if (existsSync(join(ONEPAGES, slug))) {
      return { slug, urlPath: m[2] || '/' };
    }
  }
  return null;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function safeJoin(base, target) {
  const joined = normalize(join(base, target));
  if (!joined.startsWith(base)) return null;
  return joined;
}

async function tryServe(filePath, res) {
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      return tryServe(join(filePath, 'index.html'), res);
    }
    const body = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    send(res, 200, body, { 'content-type': mime });
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function listSlugs() {
  if (!existsSync(ONEPAGES)) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(ONEPAGES, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
}

function indexPage(slugs) {
  const list = slugs.length === 0
    ? '<p>(noch keine gerenderten Seiten unter sites/onepages/)</p>'
    : `<ul>${slugs.map((s) => `<li><a href="/${s}/">/${s}/</a></li>`).join('')}</ul>`;
  return `<!doctype html><meta charset="utf-8"><title>EMJmedia Dev Preview</title>
<style>body{font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.6}</style>
<h1>EMJmedia Dev Preview</h1>
<p>Subdomain-Emulation: setze <code>Host: {slug}.localhost</code> oder rufe <code>http://localhost:${PORT}/{slug}/</code> auf.</p>
<h2>Verfügbare Slugs</h2>${list}`;
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/' && (req.headers.host ?? '').split(':')[0] === 'localhost') {
      const slugs = await listSlugs();
      send(res, 200, indexPage(slugs), { 'content-type': 'text/html; charset=utf-8' });
      return;
    }

    const ctx = detectSlug(req);
    if (!ctx) {
      send(res, 404, 'Not Found — pass a slug via Host header or /{slug}/ URL.\n', { 'content-type': 'text/plain' });
      return;
    }

    const slugDir = join(ONEPAGES, ctx.slug);
    const cleanPath = ctx.urlPath.split('?')[0];
    const requested = safeJoin(slugDir, cleanPath);
    if (!requested) {
      send(res, 400, 'Bad path');
      return;
    }

    if (await tryServe(requested, res)) return;
    if (cleanPath.endsWith('/')) {
      if (await tryServe(join(requested, 'index.html'), res)) return;
    }
    send(res, 404, `Not Found: ${ctx.slug}${cleanPath}\n`, { 'content-type': 'text/plain' });
  } catch (err) {
    console.error('dev-preview error:', err);
    send(res, 500, `Internal: ${err.message}\n`, { 'content-type': 'text/plain' });
  }
});

server.listen(PORT, () => {
  console.log(`EMJmedia dev preview → http://localhost:${PORT}/`);
  console.log(`  Subdomain mode: curl -H "Host: kfz-demo.localhost" http://localhost:${PORT}/`);
  console.log(`  Path mode:      http://localhost:${PORT}/kfz-demo/`);
});
