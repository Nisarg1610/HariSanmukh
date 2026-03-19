self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'HariSanmukh';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-256.png',
    badge: '/icon-256',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/seva'));
});