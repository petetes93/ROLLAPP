const CACHE = 'arcanum-v2-fantasy';
const SHELL = [
  './app/index.html','./app/app.js','./manifest.webmanifest','./assets/icon.svg','./assets/manifest.json',
  './assets/fonts/cinzel-decorative-400.ttf','./assets/fonts/cinzel-decorative-700.ttf','./assets/fonts/cormorant-sc-400.ttf','./assets/fonts/cormorant-sc-600.ttf','./assets/fonts/eb-garamond-400.ttf','./assets/fonts/eb-garamond-600.ttf'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./app/index.html'))));
});
