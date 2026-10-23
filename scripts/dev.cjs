const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { buildFrontend } = require('./build-frontend.cjs');
function createServer() {
  const root = buildFrontend();
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json' };
  return http.createServer((request, response) => {
    let requested;
    try { requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
    const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(data);
    });
  });
}
if (require.main === module) createServer().listen(1420, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:1420'));
module.exports = { createServer };
