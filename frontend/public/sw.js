// ─── RifaBaby Service Worker v2 ───────────────────────────────────────────────
// Handles: PWA install, offline cache, and Background Push Notifications

const CACHE_NAME = 'rifababy-v2';

self.addEventListener('install', (e) => {
  console.log('[SW] Install');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activate');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => new Response('Você está offline'))
  );
});

// ─── Background Push Notifications ────────────────────────────────────────────
// This fires even when the app is CLOSED.
self.addEventListener('push', (e) => {
  let data = { title: '🍼 RifaBaby', body: 'Nova atualização na rifa!', icon: '/banner.png' };
  try {
    if (e.data) {
      data = { ...data, ...e.data.json() };
    }
  } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/banner.png',
      badge: '/banner.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'rifababy-notif',
      renotify: true,
      data: { url: data.url || '/admin' }
    })
  );
});

// ─── Notification Click: Open Admin Panel ─────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/admin';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(target);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
