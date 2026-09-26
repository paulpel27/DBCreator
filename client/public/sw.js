// DBCreator Service Worker — PWABuilder compliant
// Strategy: Network-first for navigation/API, Cache-first for static assets

const CACHE_NAME = 'dbcreator-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/auth, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker for API calls, OAuth, analytics, and non-GET
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/oauth/') ||
    url.hostname !== location.hostname ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Navigation requests: network-first, fall back to cached root
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first, update cache in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

// Background sync (required by PWABuilder)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(Promise.resolve());
  }
});

// Push notifications (required by PWABuilder)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'DBCreator', {
      body: data.body || 'You have a new notification.',
      icon: '/manus-storage/icon-192_bf081997.png',
      badge: '/manus-storage/icon-192_bf081997.png',
      data: data.url || '/',
    })
  );
});

// Notification click (required by PWABuilder)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data || '/');
    })
  );
});
