// Secure Node.js server for 3D Sky Defender
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const VR_DIR = path.join(ROOT_DIR, 'vr');

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown'
};

const server = http.createServer((req, res) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), xr-spatial-tracking=(self)');
    
    // CORS for camera and WebXR access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Sanitize URL path - prevent directory traversal
    let urlPath = req.url.split('?')[0]; // Remove query strings
    urlPath = urlPath.replace(/\.\./g, ''); // Remove ..
    
    // Determine which directory to serve from
    let filePath;
    let baseDir;
    
    if (urlPath.startsWith('/vr')) {
        // VR version
        baseDir = VR_DIR;
        urlPath = urlPath.replace('/vr', '') || '/index.html';
        if (urlPath === '/') urlPath = '/index.html';
        filePath = path.join(VR_DIR, urlPath);
    } else {
        // Frontend version
        baseDir = FRONTEND_DIR;
        urlPath = urlPath === '/' ? '/index.html' : urlPath;
        filePath = path.join(FRONTEND_DIR, urlPath);
    }
    
    // Ensure file is within allowed directory
    if (!filePath.startsWith(baseDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            // Cache static assets
            if (ext === '.js' || ext === '.css') {
                res.setHeader('Cache-Control', 'public, max-age=3600');
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║         🎮 3D SKY DEFENDER SERVER                 ║
╠═══════════════════════════════════════════════════╣
║                                                   ║
║  2D Game: http://localhost:${PORT}                   ║
║  VR Game: http://localhost:${PORT}/vr                ║
║                                                   ║
║  ✓ Security headers enabled                       ║
║  ✓ WebXR permissions enabled                      ║
║  ✓ Meta Quest & Vision Pro ready                  ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});