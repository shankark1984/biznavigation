const CACHE_NAME = 'biznavigation-cache-v3.1.0';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/assets/css/styles.css',
    '/assets/js/utils/navbar.js',
    '/assets/js/utils/footer.js',
    '/assets/js/utils/server.js',
    '/assets/js/utils/logout.js',
    '/assets/js/UserAccessRules/AccessRules.js',
    '/assets/img/applogo-192x192.png',
    '/assets/img/applogo-512x512.png',
    '/assets/img/applogo-apple.png',
    '/assets/img/favicon.ico',
    '/pages/Tools/offline.html'
];

/* ================= INSTALL ================= */
self.addEventListener('install', event => {
    console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching App Shell');
                return cache.addAll(PRECACHE_URLS);
            })
    );

    self.skipWaiting();
});

/* ================= ACTIVATE ================= */
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            )
        )
    );

    self.clients.claim();
});

/* ================= FETCH ================= */
self.addEventListener('fetch', event => {
    const request = event.request;

    // ✅ Only GET requests
    if (request.method !== 'GET') return;

    // ✅ Ignore chrome-extension, data, file, etc.
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }

    /* ================= NAVIGATION (HTML) ================= */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    console.warn('[SW] Offline - serving fallback page');
                    return caches.match('/pages/Tools/offline.html');
                })
        );
        return;
    }

    /* ================= STATIC ASSETS ================= */
    event.respondWith(
        caches.match(request).then(cachedResponse => {

            // ✅ Serve from cache immediately (fast)
            if (cachedResponse) {
                return cachedResponse;
            }

            // ✅ Otherwise fetch from network
            return fetch(request)
                .then(networkResponse => {

                    // ❗ Only cache valid responses
                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        networkResponse.type !== 'basic'
                    ) {
                        return networkResponse;
                    }

                    const responseClone = networkResponse.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });

                    return networkResponse;
                })
                .catch(() => {

                    // ✅ Image fallback
                    if (request.destination === 'image') {
                        return caches.match('/assets/img/applogo-192x192.png');
                    }

                    // Optional: fallback for CSS/JS
                    if (request.destination === 'style' || request.destination === 'script') {
                        return new Response('', { status: 200 });
                    }
                });
        })
    );
});