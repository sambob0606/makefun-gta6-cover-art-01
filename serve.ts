/* Palmline dev server: serves app/ on http://localhost:8080 so the
   cover studio can be tried in a desktop browser. Static files only,
   no directory listing, no path escapes above app/. */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), 'app');
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function serveFile(filePath, res) {
  const type = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
  const body = readFileSync(filePath);
  res.writeHead(200, { 'content-type': type, 'content-length': body.length });
  res.end(body);
}

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = normalize(join(root, relPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    serveFile(filePath, res);
    return;
  }
  res.writeHead(404);
  res.end('Not found: ' + urlPath);
});

server.listen(port, () => {
  console.log('Palmline Poster Studio at http://localhost:' + port);
});
