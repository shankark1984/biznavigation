const CACHE_NAME = 'biznavigation-cache-v3.04.03.04';
const MAX_CACHE_ITEMS = 50;

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
    const keys = await cache.keys();

    if (keys.length > maxItems) {
        await cache.delete(keys[0]);
        await limitCacheSize(cacheName, maxItems);
    }
}

/* ================= INSTALL ================= */
self.addEventListener('install', event => {

    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const url of PRECACHE_URLS) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(res.status);
                    await cache.put(url, res);
                    // console.log('[SW] Cached:', url);
                } catch (err) {
                    // console.error('[SW] Failed:', url);
                }
            }
        })
    );

    self.skipWaiting();
});

/* ================= ACTIVATE ================= */
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');

    event.waitUntil(
        (async () => {
            const keys = await caches.keys();

            // delete old caches
            await Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );

            // notify all tabs (instant update)
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach(client => {
                client.postMessage({ type: 'SW_UPDATED' });
            });

            await self.clients.claim();
        })()
    );
});

/* ================= MESSAGE ================= */
self.addEventListener('message', event => {
    if (event.data?.action === 'skipWaiting') {
        console.log('[SW] Skip waiting triggered');
        self.skipWaiting();
    }
});

/* ================= FETCH ================= */
self.addEventListener('fetch', event => {
    const request = event.request;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    /* ================= API (Supabase) ================= */
    if (url.hostname.includes('supabase.co')) {

        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                        limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
                    });

                    return response;
                })
                .catch(() => caches.match(request))
        );

        return;
    }

    /* ================= NAVIGATION (HTML) ================= */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match('/pages/Tools/offline.html'))
        );
        return;
    }

    /* ================= STATIC ASSETS ================= */
    event.respondWith(
        caches.match(request).then(cachedResponse => {

            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(request)
                .then(networkResponse => {

                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        networkResponse.type !== 'basic'
                    ) {
                        return networkResponse;
                    }

                    const responseClone = networkResponse.clone();

                    // cache all non-API assets
                    if (!url.pathname.startsWith('/api/')) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                            limitCacheSize(CACHE_NAME, MAX_CACHE_ITEMS);
                        });
                    }

                    return networkResponse;
                })
                .catch(() => {

                    if (request.destination === 'image') {
                        return caches.match('/assets/img/applogo-192x192.png');
                    }

                    console.warn('[SW] Failed:', request.url);
                });
        })
    );
});