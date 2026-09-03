const VERSION = 'v3.04.08.05';
const STATIC_CACHE = `biznav-static-${VERSION}`;
const DYNAMIC_CACHE = `biznav-dynamic-${VERSION}`;
const MAX_DYNAMIC_ITEMS = 50;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/login.html',
    '/pages/Tools/offline.html',
    '/assets/img/applogo-192x192.png'
];

/* ================= CACHE LIMIT (Optimized) ================= */
// Uses a while loop instead of recursion to prevent stack overflow
async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    let keys = await cache.keys();

    while (keys.length > maxItems) {
        await cache.delete(keys[0]);
        keys = await cache.keys(); // Re-evaluate keys
    }
}

/* ================= INSTALL ================= */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async cache => {
            for (const url of PRECACHE_URLS) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed: ${response.status}`);
                    await cache.put(url, response);
                } catch (err) {
                    console.warn('[SW] Failed to cache precache URL:', url, err);
                }
            }
        })
    );
    self.skipWaiting(); // Forces the waiting service worker to become active immediately
});

/* ================= ACTIVATE ================= */
self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            // Delete old caches
            await Promise.all(
                keys.filter(key => key.startsWith('biznav-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );

            await self.clients.claim(); // Take control of all open pages immediately

            // Notify all open clients that an update is live
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        })()
    );
});

/* ================= MESSAGE ================= */
self.addEventListener('message', event => {
    if (event.data?.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

/* ================= FETCH ================= */
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Block localhost and non-http(s) requests
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || !url.protocol.startsWith('http')) {
        return;
    }

    // Ignore specific external APIs completely
    if (url.hostname.includes('api.postalpincode.in')) {
        return;
    }

    /* 1. SUPABASE API (Network First -> Dynamic Cache -> Offline JSON) */
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(DYNAMIC_CACHE).then(cache => {
                            cache.put(request, clone);
                            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_ITEMS);
                        });
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    return cached || new Response(
                        JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    /* 2. HTML NAVIGATION (Network First -> Static Cache -> Offline HTML) */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(async () => {
                    // Try to get the requested page from cache first
                    const cachedPage = await caches.match(request);
                    if (cachedPage) return cachedPage;

                    // Fallback to offline page
                    return caches.match('/pages/Tools/offline.html');
                })
        );
        return;
    }

    /* 3. STATIC FILES (Cache First -> Network -> Static Cache -> Image Fallback) */
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(request)
                .then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Only cache assets from our own origin
                    if (url.origin === self.location.origin) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Image fallback
                    if (request.destination === 'image') {
                        return caches.match('/assets/img/applogo-192x192.png');
                    }
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});