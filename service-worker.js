const CACHE_NAME = 'vidyalite-v5';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './vendor/lucide.min.js',
  './icons/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('vidyalite-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.includes('/api/')) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== 'opaque') {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        } catch (error) {
          console.warn('VidyaLite could not cache a response:', error);
        }
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const appShell = await caches.match('./index.html');
        if (appShell) return appShell;
      }
      return new Response('Offline resource unavailable.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
