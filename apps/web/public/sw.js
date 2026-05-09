const CACHE = 'valugrid-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => clients.claim())
  );
});

// Only cache static assets — never intercept HTML navigation
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Let all HTML navigation requests go to network
  if (request.mode === 'navigate') return;

  // Let API calls go to network always
  if (url.pathname.startsWith('/api/')) return;

  // For static assets only, try cache first
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
  }
});

// Background sync for offline delivery queue
self.addEventListener('sync', e => {
  if (e.tag === 'vg-sync-deliveries') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'VG_SYNC_START' }))
      )
    );
  }
});
