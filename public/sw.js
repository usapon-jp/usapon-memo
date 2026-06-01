const CACHE_NAME = 'usapon-memo-v7';
const APP_SHELL = [
  '/usapon-memo/',
  '/usapon-memo/manifest.webmanifest',
  '/usapon-memo/assets/cork-board.jpg',
  '/usapon-memo/assets/fonts/HuiFontP29.ttf',
  '/usapon-memo/assets/app-icon.png',
  '/usapon-memo/assets/usa.png',
  '/usapon-memo/assets/piyo.png',
  '/usapon-memo/assets/pon.png',
  '/usapon-memo/assets/lemon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('/usapon-memo/', copy));
        return response;
      }).catch(() => caches.match('/usapon-memo/'))
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request))
  );
});
