// ─── RifaBaby Service Worker v3 ───────────────────────────────────────────────
// Handles: PWA install, offline cache, Web Push notifications with sound

const VAPID_PUBLIC = 'BLqLhw2gqsuw7dX15HJmL9mx652r3FBViKcbjTYsvPf1BNGOiORuW8mAeoQHnb9d0h3ZB0XacxfriFq-FHm6FPY';
const API_BASE = 'https://rifas-baby-go.onrender.com/api';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => new Response('Você está offline')));
});

// ─── Background Push Notifications ────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = { title: '🍼 RifaBaby', body: 'Nova atualização na rifa!', icon: '/banner.png', tag: 'rifababy', url: '/admin' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/banner.png',
      badge: '/banner.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: data.tag || 'rifababy',
      renotify: true,
      requireInteraction: false,
      data: { url: data.url || '/admin' }
    })
  );
});

// ─── Notification Click: Open/Focus Admin Panel ────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/admin';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
