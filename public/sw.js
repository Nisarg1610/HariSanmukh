self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'HariSanmukh';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-256.png',
    badge: '/icon-256.png', // FIXED extension
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

// --- PWA Offline Core ---
const CACHE_NAME = 'hs-offline-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache only mission critical core files
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icon-192.png',
        '/icon-256.png'
      ]).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We only intercept GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Skip supabase api, our own APIs, or weird schemas
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase.co') || 
      !url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If it's a good response, clone it to cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed (timeout, airplane mode, etc.)
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // If not in cache, and it's navigation, serve '/' as fallback SPA
        if (event.request.mode === 'navigate') {
          const rootCache = await caches.match('/');
          if (rootCache) return rootCache;
        }

        // Return a broken offline response
        return new Response('Offline Mode', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});