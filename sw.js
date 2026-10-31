/* Service worker : mise en cache de l'application et des questions pour le mode hors ligne.
   Incrémenter VERSION à chaque publication pour déclencher la mise à jour. */
const VERSION = 'ad5-v1-lot3';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'figures.js', 'manifest.webmanifest',
  'data/verbal.json', 'data/numerical.json', 'data/abstract.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
