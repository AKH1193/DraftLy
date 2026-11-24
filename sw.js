/* DraftLy offline cache: the app works with no internet once opened. */
const CACHE = 'draftly-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/icons.js', 'js/zip.js', 'js/docx-export.js', 'js/docx-import.js', 'js/review.js', 'js/pdf.js', 'js/core.js', 'js/sync.js', 'js/ui.js', 'js/table.js', 'js/extras.js', 'js/compare.js', 'js/ribbon.js', 'js/file.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // never cache sync traffic
  // network first for the app shell so updates arrive quickly; fall back to cache offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
