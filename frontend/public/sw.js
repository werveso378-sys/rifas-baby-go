self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activate');
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Um fetch vazio é obrigatório pelo Google Chrome para validar o PWA
  e.respondWith(
    fetch(e.request).catch(() => {
      // Se der erro de rede, apenas retorna uma resposta vazia para não quebrar o Chrome
      return new Response('Você está offline');
    })
  );
});
