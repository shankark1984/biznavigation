const CACHE_NAME = 'biznavigation-cache-v3.0.0';
const PRECACHE_URLS = [
    '/', // root
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
    '/pages/Tools/offline.html' // offline fallback page
];

// Install Event: Cache the app shell
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Precaching app shell');
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting(); // Activate worker immediately
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim(); // Take control immediately
});

// Fetch Event: Cache-first for static assets, network-first for navigation
self.addEventListener('fetch', event => {
    const request = event.request;

    // Only handle GET requests
    if (request.method !== 'GET') return;

    // Network-first strategy for navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Put a copy in the cache
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, response.clone());
                        return response;
                    });
                })
                .catch(() =>
                    caches.match('/pages/Tools/offline.html')
                )
        );
        return;
    }

    // Cache-first strategy for static assets (CSS, JS, images)
    event.respondWith(
        caches.match(request).then(cacheRes => {
            return cacheRes || fetch(request).then(networkRes => {
                // Cache the fetched response for future requests
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, networkRes.clone());
                    return networkRes;
                });
            }).catch(() => {
                // Optional: fallback for images if offline
                if (request.destination === 'image') {
                    return '/assets/img/applogo-192x192.png';
                }
            });
        })
    );
});