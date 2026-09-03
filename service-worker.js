const VERSION = 'v3.04.08.06';
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

/* ================= CACHE LIMIT ================= */
async function limitCacheSize(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    let keys = await cache.keys();
    while (keys.length > maxItems) {
        await cache.delete(keys[0]);
        keys = await cache.keys();
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
    // REMOVED: self.skipWaiting() here causes immediate hijacking and reload loops
});

/* ================= ACTIVATE ================= */
self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.filter(key => key.startsWith('biznav-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
            await self.clients.claim();
            // REMOVED: Do not blast SW_UPDATED to clients here
        })()
    );
});

/* ================= MESSAGE ================= */
self.addEventListener('message', event => {
    // Support both formats
    if (event.data?.action === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/* ================= FETCH ================= */
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Bypass localhost/127.0.0.1 entirely in development
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || !url.protocol.startsWith('http')) {
        return;
    }

    if (url.hostname.includes('api.postalpincode.in')) {
        return;
    }

    /* 1. SUPABASE API */
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

    /* 2. HTML NAVIGATION */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    if (cachedPage) return cachedPage;
                    return caches.match('/pages/Tools/offline.html');
                })
        );
        return;
    }

    /* 3. STATIC ASSETS */
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(request)
                .then(networkResponse => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    if (url.origin === self.location.origin) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    if (request.destination === 'image') {
                        return caches.match('/assets/img/applogo-192x192.png');
                    }
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});