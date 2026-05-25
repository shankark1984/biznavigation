const CACHE_NAME = 'biznavigation-cache-v3.04.05.02';
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

    // console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {

            for (const url of PRECACHE_URLS) {

                try {

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`Failed: ${response.status}`);
                    }

                    await cache.put(url, response);

                    // console.log('[SW] Cached:', url);

                } catch (err) {

                    console.warn('[SW] Failed to cache:', url, err);
                }
            }
        })
    );

    self.skipWaiting();
});

/* ================= ACTIVATE ================= */
self.addEventListener('activate', event => {

    // console.log('[SW] Activating...');

    event.waitUntil(
        (async () => {

            const keys = await caches.keys();

            // delete old caches
            await Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );

            // notify all tabs
            const clients = await self.clients.matchAll({
                type: 'window'
            });

            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED'
                });
            });

            await self.clients.claim();

            // console.log('[SW] Activated');

        })()
    );
});

/* ================= MESSAGE ================= */
self.addEventListener('message', event => {

    if (event.data?.action === 'skipWaiting') {

        // console.log('[SW] Skip waiting triggered');

        self.skipWaiting();
    }
});

/* ================= FETCH ================= */
self.addEventListener('fetch', event => {

    const request = event.request;

    // only GET requests
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // only http/https
    if (
        url.protocol !== 'http:' &&
        url.protocol !== 'https:'
    ) {
        return;
    }

    /* =========================================================
       EXTERNAL APIs
       Let browser handle directly
    ========================================================= */
    if (
        url.hostname.includes('api.postalpincode.in')
    ) {
        return;
    }

    /* =========================================================
       SUPABASE API
       Network First + Cache Fallback
    ========================================================= */
    if (
        url.hostname.includes('supabase.co')
    ) {

        event.respondWith(

            fetch(request)

                .then(response => {

                    // cache successful responses
                    if (response && response.status === 200) {

                        const clone = response.clone();

                        caches.open(CACHE_NAME).then(cache => {

                            cache.put(request, clone);

                            limitCacheSize(
                                CACHE_NAME,
                                MAX_CACHE_ITEMS
                            );
                        });
                    }

                    return response;
                })

                .catch(async err => {

                    console.warn(
                        '[SW] Supabase fetch failed:',
                        err
                    );

                    const cached = await caches.match(request);

                    if (cached) {
                        return cached;
                    }

                    return new Response(
                        JSON.stringify({
                            error: 'Offline'
                        }),
                        {
                            status: 503,
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                })
        );

        return;
    }

    /* =========================================================
       HTML NAVIGATION
       Network First + Offline Page
    ========================================================= */
    if (request.mode === 'navigate') {

        event.respondWith(

            fetch(request)

                .catch(async () => {

                    return await caches.match(
                        '/pages/Tools/offline.html'
                    );
                })
        );

        return;
    }

    /* =========================================================
       STATIC FILES
       Cache First + Network Fallback
    ========================================================= */
    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                // return cached version
                if (cachedResponse) {
                    return cachedResponse;
                }

                // fetch from network
                return fetch(request)

                    .then(networkResponse => {

                        // invalid response
                        if (
                            !networkResponse ||
                            networkResponse.status !== 200
                        ) {
                            return networkResponse;
                        }

                        // clone response
                        const responseClone =
                            networkResponse.clone();

                        // cache same-origin assets only
                        if (
                            url.origin === self.location.origin &&
                            !url.pathname.startsWith('/api/')
                        ) {

                            caches.open(CACHE_NAME).then(cache => {

                                cache.put(
                                    request,
                                    responseClone
                                );

                                limitCacheSize(
                                    CACHE_NAME,
                                    MAX_CACHE_ITEMS
                                );
                            });
                        }

                        return networkResponse;
                    })

                    .catch(async err => {

                        console.warn(
                            '[SW] Fetch failed:',
                            request.url,
                            err
                        );

                        // image fallback
                        if (
                            request.destination === 'image'
                        ) {

                            const fallbackImage =
                                await caches.match(
                                    '/assets/img/applogo-192x192.png'
                                );

                            if (fallbackImage) {
                                return fallbackImage;
                            }
                        }

                        // offline html fallback
                        if (
                            request.mode === 'navigate'
                        ) {

                            const offlinePage =
                                await caches.match(
                                    '/pages/Tools/offline.html'
                                );

                            if (offlinePage) {
                                return offlinePage;
                            }
                        }

                        // generic fallback
                        return new Response(
                            'Offline',
                            {
                                status: 503,
                                statusText: 'Offline'
                            }
                        );
                    });
            })
    );
}); 