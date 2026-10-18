#!/usr/bin/env node
// Zero-dependency static server: node scripts/serve.js [port]
// Listens on every interface so phones on the same Wi-Fi can open the app.
// Text files are gzip-compressed and revalidated with Last-Modified (304) to keep phone loads fast.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);
// Audio, images and stroke data never change once imported
const IMMUTABLE = /\/src\/(assets\/|js\/data\/strokes\/)/;
const gzipCache = new Map(); // file → { mtimeMs, body }

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info) throw new Error('not found');

    const ext = path.extname(file);
    const lastModified = info.mtime.toUTCString();
    const headers = {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Last-Modified': lastModified,
      'Cache-Control': IMMUTABLE.test(urlPath) ? 'public, max-age=31536000, immutable' : 'no-cache',
      Vary: 'Accept-Encoding',
    };
    if (req.headers['if-modified-since'] === lastModified) { res.writeHead(304, headers).end(); return; }

    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      let cached = gzipCache.get(file);
      if (!cached || cached.mtimeMs !== info.mtimeMs) {
        cached = { mtimeMs: info.mtimeMs, body: gzipSync(await readFile(file)) };
        gzipCache.set(file, cached);
      }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': cached.body.length });
      res.end(req.method === 'HEAD' ? undefined : cached.body);
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`HànZì Master → http://localhost:${PORT}`);
  const lan = Object.values(networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.'));
  for (const n of lan) console.log(`Trên điện thoại (cùng Wi-Fi) → http://${n.address}:${PORT}`);
});
