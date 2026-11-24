/* Palletizer 离线缓存 */
const CACHE = 'palletizer-v1.9.9';
const ASSETS = [
  './',
  './index.html',
  './css/mobile.css',
  './css/readability.css',
  './css/responsive.css',
  './js/xlsx-lite.js',
  './js/core.js',
  './js/render3d.js',
  './js/mobile.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './desktop/',
  './desktop/index.html',
  './desktop/css/style.css',
  './desktop/js/core.js',
  './desktop/js/xlsx-lite.js',
  './desktop/js/render3d.js',
  './desktop/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // 精确求解器体积大、只在线使用，不经过离线缓存
  if (url.pathname.endsWith('/exact.html') ||
      url.pathname.endsWith('/js/exact-layer.js') ||
      url.pathname.includes('/vendor/cp-sat/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'offline' });
      });
    })
  );
});
