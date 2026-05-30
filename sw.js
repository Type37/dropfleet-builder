// Service worker for offline support. Network-first for fresh content when
// online (the app updates often), falling back to cache when offline, and
// populating the cache as resources are fetched.
// Bump this on every deploy so existing clients purge the old cache on activate
// (the app updates frequently — stale assets must not survive a new build).
const CACHE = 'dfc-cache-v3';
const CORE = [
  './',
  './index.html',
  './css/app.css',
  './css/mobile-fixes.css',
  './js/app.js',
  './data/fleet-index.json',
  './assets/fonts/Arkhip.woff2',
  './assets/logos/dfc_logo.webp',
  './assets/logos/dfc_logo_text.webp',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (fonts CDN) pass through

  e.respondWith(
    fetch(req)
      .then(res => {
        // cache a copy of successful same-origin responses
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
