const CACHE_NAME = 'biznavigation-cache-v1';
const PRECACHE_URLS = [
    '/', // optional: add /index.html if serving from root
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
    '/assets/img/favicon.ico'
    // Add more assets as needed
];

// Install Event: Caching app shell
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

// Activate Event: Cleanup old caches
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

// Fetch Event: Serve from cache, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cacheRes => {
            return (
                cacheRes ||
                fetch(event.request).catch(() =>
                    caches.match('/pages/Tools/offline.html') // Optional offline fallback
                )
            );
        })
    );
});
