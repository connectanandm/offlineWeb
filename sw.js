const CACHE_NAME = 'offline-cache-v4';
const OFFLINE_URL = 'offline.html';
const OFFLINE_MSG_URL = 'offline-message.txt';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        OFFLINE_URL,
        OFFLINE_MSG_URL // Initially cache offline message
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);

  // ✅ Handle offline-message.txt with stale-while-revalidate
  if (requestURL.pathname.endsWith(OFFLINE_MSG_URL)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => null); // Don't fail, fallback to cache

          return cachedResponse || fetchPromise || new Response('Message not available.', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
      )
    );
    return;
  }

  // ✅ Handle HTML navigation (offline fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // ✅ Handle other static assets (cache-first strategy)
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
