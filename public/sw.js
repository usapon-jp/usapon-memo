const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `usapon-memo-${BUILD_ID}`;
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
      keys.filter((key) => key.startsWith('usapon-memo-') && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (new URL(request.url).pathname.endsWith('/handwriting/models/isnet-general-use-q8.onnx')) {
    event.respondWith(caches.open('usapon-cutout-model-feed6f32a').then(async (cache) => {
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      return response;
    }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(async () => (
        await caches.match(request)
        || await caches.match('/usapon-memo/')
      ))
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
