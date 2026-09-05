'use strict';
// CI-only static preview: loopback binding, no credentials, no write endpoints.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const baseline = path.join(root, '.workspace-baseline');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const isBase = pathname.startsWith('/baseline/');
    const relative = isBase ? pathname.slice('/baseline/'.length) : pathname.slice(1);
    // Expose only tool assets; never .git, dependencies, or the runner filesystem.
    if (!relative.startsWith('O-Ne-Tools/')) { res.writeHead(404).end(); return; }
    const directory = path.join(isBase ? baseline : root, 'O-Ne-Tools');
    let file = path.resolve(isBase ? baseline : root, relative);
    if (!file.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end(); }
}).listen(4173, '127.0.0.1');
