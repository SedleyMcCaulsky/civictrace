const CACHE = 'valugrid-v1';
const OFFLINE_QUEUE_KEY = 'vg_delivery_queue';

const CACHE_URLS = [
  '/dashboard/deliveries',
  '/offline.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    fetch(request).catch(() => caches.match(request).then(r => r || caches.match('/offline.html')))
  );
});

// Background sync — flush queued deliveries when online
self.addEventListener('sync', e => {
  if (e.tag === 'vg-sync-deliveries') {
    e.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const clients_list = await self.clients.matchAll();
  clients_list.forEach(c => c.postMessage({ type: 'VG_SYNC_START' }));
}
