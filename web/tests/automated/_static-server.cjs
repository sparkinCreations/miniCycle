/**
 * Tiny static file server for the standalone Playwright test runners
 * (run-layout-overlap-tests.cjs, run-sw-offline-tests.cjs).
 *
 * Why not `python3 -m http.server`: spawning python3 + polling `localhost` is
 * fragile in CI (python may not be spawnable on PATH from Node; `localhost` can
 * resolve to IPv6 ::1 while a python server binds IPv4-only → the health check
 * never connects → "server did not start"). A built-in Node server bound
 * explicitly to 127.0.0.1 removes both failure modes and lets the SW test kill
 * the server deterministically (close() destroys live sockets too).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
    '.ico': 'image/x-icon', '.map': 'application/json', '.webmanifest': 'application/manifest+json',
    '.txt': 'text/plain', '.xml': 'application/xml'
};

// Start a static server rooted at `root`, listening on 127.0.0.1:port.
// Resolves to { url, close } where close() also destroys live sockets so the
// SW test's "dead server" simulation produces real connection failures.
function startStaticServer(root, port) {
    const rootResolved = path.resolve(root);
    const sockets = new Set();

    const server = http.createServer((req, res) => {
        let pathname;
        try {
            pathname = decodeURIComponent((req.url || '/').split('?')[0]);
        } catch {
            res.writeHead(400); return res.end('bad request');
        }
        if (pathname.endsWith('/')) pathname += 'index.html';
        const filePath = path.join(rootResolved, pathname);
        // Block path traversal outside the root.
        if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) {
            res.writeHead(403); return res.end('forbidden');
        }
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
            res.end(data);
        });
    });

    server.on('connection', (sock) => {
        sockets.add(sock);
        sock.on('close', () => sockets.delete(sock));
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => {
            resolve({
                url: `http://127.0.0.1:${port}`,
                close: () => new Promise((r) => {
                    for (const s of sockets) s.destroy();
                    server.close(() => r());
                })
            });
        });
    });
}

module.exports = { startStaticServer };
