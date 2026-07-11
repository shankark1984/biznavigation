const CACHE_NAME = 'biznavigation-cache-v3.04.07.27';
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

    // block localhost requests completely
    if (
        url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost'
    ) {

        // console.warn(
        //     '[SW] Blocked localhost request:',
        //     request.url
        // );

        return;
    }

    // only http/https
    if (
        url.protocol !== 'http:' &&
        url.protocol !== 'https:'
    ) {
        return;
    }

    /* =========================================================
       EXTERNAL APIs
    ========================================================= */
    if (
        url.hostname.includes('api.postalpincode.in')
    ) {
        return;
    }

    /* =========================================================
       SUPABASE API
    ========================================================= */
    if (
        url.hostname.includes('supabase.co')
    ) {

        event.respondWith(

            fetch(request)

                .then(response => {

                    if (
                        response &&
                        response.status === 200
                    ) {

                        const clone = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {

                                cache.put(request, clone);

                                limitCacheSize(
                                    CACHE_NAME,
                                    MAX_CACHE_ITEMS
                                );
                            });
                    }

                    return response;
                })

                .catch(async () => {

                    const cached =
                        await caches.match(request);

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
                                'Content-Type':
                                    'application/json'
                            }
                        }
                    );
                })
        );

        return;
    }

    /* =========================================================
       HTML NAVIGATION
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
    ========================================================= */
    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)

                    .then(networkResponse => {

                        if (
                            !networkResponse ||
                            networkResponse.status !== 200
                        ) {
                            return networkResponse;
                        }

                        const responseClone =
                            networkResponse.clone();

                        // cache only production assets
                        if (
                            url.origin === self.location.origin &&
                            !request.url.includes('127.0.0.1') &&
                            !request.url.includes('localhost')
                        ) {

                            caches.open(CACHE_NAME)
                                .then(cache => {

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

                            return await caches.match(
                                '/assets/img/applogo-192x192.png'
                            );
                        }

                        // offline page
                        if (
                            request.mode === 'navigate'
                        ) {

                            return await caches.match(
                                '/pages/Tools/offline.html'
                            );
                        }

                        return new Response(
                            'Offline',
                            {
                                status: 503
                            }
                        );
                    });
            })
    );
});