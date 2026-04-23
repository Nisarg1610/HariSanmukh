// ─── Cache Configuration ───────────────────────────────────────────────────────
const CACHE_NAME = 'hariprabodham-v2';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-256.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

// Patterns that should NEVER be cached (always go to network)
const NETWORK_ONLY_PATTERNS = [
  /\/api\//,          // All API routes — always fresh
  /supabase\.co/,     // Supabase calls
  /oauth/,            // Auth flows
  /auth/,
];

// ─── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// ─── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim(); // Take control of all open tabs immediately
    })
  );
});

// ─── Fetch: smart caching strategy ────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  const url = event.request.url;

  // Skip non-GET requests entirely
  if (event.request.method !== 'GET') return;

  // Network-only for API/auth routes
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some(function (pattern) {
    return pattern.test(url);
  });
  if (isNetworkOnly) return;

  // For navigation requests (HTML pages) — Network-first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          // Cache a fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function () {
          // Offline: serve cached shell
          return caches.match('/') || caches.match(event.request);
        })
    );
    return;
  }

  // For static assets (images, fonts, scripts) — Cache-first
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        // Only cache successful, same-origin responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});

// ─── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'HariPrabodham';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-256.png',
    badge: '/icon-256.png',
    data: {
      url: data.url || '/'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});