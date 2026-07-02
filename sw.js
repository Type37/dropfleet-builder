// Service worker for offline support. Network-first for fresh content when
// online (the app updates often), falling back to cache when offline, and
// populating the cache as resources are fetched.
// Bump this on every deploy so existing clients purge the old cache on activate
// (the app updates frequently — stale assets must not survive a new build).
const CACHE = 'dfc-cache-v354';
// Same-origin code/data that MUST be fresh when online. Network-first alone is
// not enough: fetch() still consults the browser HTTP cache, so a client can
// keep running a stale app.js for as long as GitHub Pages' cache headers allow.
// For these we force a true network hit (cache:'no-store'), falling back to the
// SW cache only when offline. Images/fonts keep normal caching (they're large
// and rarely change).
const FRESH_RE = /\.(?:html|js|css|json|webmanifest)(?:\?|$)/i;
const CORE = [
  './',
  './index.html',
  './css/app.css',
  './css/mobile-fixes.css',
  './js/rank-insignia.js',
  './js/calc-engine.js',
  './js/calc-data.js',
  './js/app.js',
  './js/calc-ui.js',
  './data/fleet-index.json',
  './assets/logos/dfc_logo.webp',
  './assets/logos/dfc_logo_text.webp',
  './manifest.webmanifest',
  // Mobile sub-app shell (so /mobile/ works offline too)
  './mobile/',
  './mobile/index.html',
  './mobile/css/mobile.css',
  './mobile/js/mobile.js',
  './mobile/manifest.webmanifest'
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

  // The root SW controls the whole origin — desktop AND the /mobile/ sub-app.
  // Both use the same strategy: network-first for fresh content when online,
  // falling back to cache when offline (so each works at the table with no signal).
  const isMobile = url.pathname.includes('/mobile/');
  const offlineShell = isMobile ? './mobile/index.html' : './index.html';

  // Navigations and code/data: bypass the HTTP cache so clients always run the
  // latest build when online. Everything else: ordinary network-first.
  const mustBeFresh = req.mode === 'navigate' || FRESH_RE.test(url.pathname);
  const netFetch = mustBeFresh ? fetch(req, { cache: 'no-store' }) : fetch(req);

  e.respondWith(
    netFetch
      .then(res => {
        // cache a copy of successful same-origin responses (offline fallback)
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match(offlineShell)))
  );
});
