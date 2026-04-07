const CACHE_NAME = 'temporalizador-v10';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/logo-styles.css',
    '/time-controls.css',
    '/script.js',
    '/logo.png',
    '/icon_transparente.png',
    '/icono.ico',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Network-first: siempre intenta la red, solo usa cache si no hay conexión
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Guardar copia fresca en cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Sin conexión: usar cache
                return caches.match(event.request);
            })
    );
});
