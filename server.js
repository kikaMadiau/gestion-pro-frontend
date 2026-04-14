const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;
const ROOT = path.resolve(__dirname);
const VIEWS = path.join(ROOT, 'views');

const ALLOWED_ORIGINS = [
  'http://127.0.0.1:8000',
  'http://localhost:8000'
];

// Routes frontend
const friendlyRoutes = new Map([
  ['/', 'index.html'],
  ['/login', 'index.html'],
  ['/dashboard', 'home.html'],
  ['/users', 'users.html'],
  ['/visites', 'visites.html'],
  ['/visites/toutes', 'all-visites.html'],
  ['/verification', 'verification.html'],
  ['/security', 'page-security.html'],
  ['/terminal', 'page-terminal.html'],
  ['/rapport', 'rapport_template.html']
]);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const normalizePath = (raw) => {
  if (!raw) return '/';
  const clean = raw.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
};

// HEADERS
const applyHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, UPDATE');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
};

// SERVE FILE
const serveFile = (req, res, filepath, status = 200) => {
  const isHtml = filepath.endsWith('.html');
  const baseDir = isHtml ? VIEWS : ROOT;

  const absolute = path.normalize(path.join(baseDir, filepath));

  if (!absolute.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(absolute, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(absolute).toLowerCase();

    applyHeaders(req, res);

    res.writeHead(status, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      ...(ext !== '.html' && { 'Cache-Control': 'public, max-age=3600' }),
    });

    fs.createReadStream(absolute).pipe(res);
  });
};

// SERVER
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = normalizePath(url.pathname);

  console.log(`${req.method} ${pathname}`);

  // CORS
  if (req.method === 'OPTIONS') {
    applyHeaders(req, res);
    res.writeHead(204);
    return res.end();
  }

  // FIX ASSETS (IMPORTANT — MAINTENANT AU BON ENDROIT)
  if (
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts')
  ) {
    const publicPath = path.join(ROOT, 'public', pathname);

    fs.stat(publicPath, (err, stats) => {
      if (!err && stats.isFile()) {
        return serveFile(req, res, path.join('public', pathname));
      }

      console.warn('Asset not found:', pathname);
      res.writeHead(404);
      return res.end('Not found');
    });

    return;
  }

  // Friendly routes
  const routeTarget = friendlyRoutes.get(pathname);
  if (routeTarget) {
    return serveFile(req, res, routeTarget);
  }

  // Static ROOT
  const rootCandidate = path.join(ROOT, pathname);
  fs.stat(rootCandidate, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(req, res, pathname);
    }

    // HTML direct access views
    if (pathname.endsWith('.html')) {
      const viewFile = pathname.replace('/', '');

      return serveFile(req, res, viewFile);
    }

    // fallback
    console.warn('Fallback → index.html');
    return serveFile(req, res, 'index.html');
  });
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
