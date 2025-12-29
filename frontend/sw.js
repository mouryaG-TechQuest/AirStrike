// Service Worker for offline support
const CACHE_NAME = 'sky-defender-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/styles.css',
    './js/game3d.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});