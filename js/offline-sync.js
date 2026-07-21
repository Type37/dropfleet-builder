/* Offline data sync — shared by the desktop app and the /mobile/ sub-app.
 *
 * The service worker already caches whatever you happen to visit, which is not
 * enough: someone who only ever opened UCM would sit down at a table with no
 * signal and find five factions missing. This downloads the whole thing up
 * front, on purpose, with the size shown before you commit to it.
 *
 * Storage lives in its own cache (dfc-offline) rather than the versioned
 * dfc-cache-vN, so a deploy never silently throws away a 26 MB download the
 * user chose to make, and "Delete downloaded data" never breaks the app shell.
 * The SW's offline fallback uses CacheStorage.match(), which searches every
 * cache, so files landed here are served automatically with no SW changes.
 */
window.OfflineSync = (function () {
  'use strict';

  const CACHE = 'dfc-offline';
  const MANIFEST_URL = 'data/offline-manifest.json';
  const META_KEY = 'dfc_offline_meta';
  // Concurrency: enough to saturate a phone's connection, low enough that a
  // flaky tournament hotspot doesn't drop half the requests at once.
  const PARALLEL = 6;

  // Both apps live one directory apart (/ and /mobile/). Manifest URLs are
  // repo-root-relative ('./data/…'), so resolve them against the origin root
  // and not against whichever page is asking.
  const ROOT = new URL(
    location.pathname.includes('/mobile/') ? '../' : './',
    location.href
  );
  const abs = (u) => new URL(u.replace(/^\.\//, ''), ROOT).href;

  const supported = 'caches' in window;

  /* ── Metadata (last sync time, what was downloaded) ────────── */

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || null; } catch (e) { return null; }
  }
  function writeMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
  }
  function clearMeta() {
    try { localStorage.removeItem(META_KEY); } catch (e) {}
  }

  /* ── Connection ────────────────────────────────────────────── */

  // navigator.connection is Chromium-only; iOS Safari and Firefox report
  // nothing. Callers must treat 'unknown' as "don't auto-download" rather than
  // assuming wifi, or an iPhone on cellular would silently pull 26 MB.
  function connectionType() {
    if (!navigator.onLine) return 'offline';
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return 'unknown';
    if (c.saveData) return 'metered';
    if (c.type === 'wifi' || c.type === 'ethernet') return 'wifi';
    if (c.type === 'cellular') return 'cellular';
    // Some browsers expose only effectiveType. 4g on an unknown transport is
    // still not a promise of an unmetered connection, so it stays 'unknown'.
    return 'unknown';
  }
  const isWifi = () => connectionType() === 'wifi';

  /* ── Formatting ────────────────────────────────────────────── */

  function formatBytes(b) {
    if (!b) return '0 MB';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function formatWhen(ts) {
    if (!ts) return 'never';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ts).toLocaleDateString();
  }

  /* ── Manifest ──────────────────────────────────────────────── */

  let manifestCache = null;
  async function getManifest() {
    if (manifestCache) return manifestCache;
    const res = await fetch(abs(MANIFEST_URL), { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load the file list (HTTP ' + res.status + ')');
    manifestCache = await res.json();
    return manifestCache;
  }

  /* ── Status ────────────────────────────────────────────────── */

  // What the Settings panel renders. Never throws: an offline client still has
  // to be able to open Settings and read "downloaded 2 days ago".
  async function status() {
    const meta = readMeta();
    const base = {
      supported,
      online: navigator.onLine,
      connection: connectionType(),
      lastSync: meta ? meta.at : null,
      lastSyncText: formatWhen(meta ? meta.at : null),
      downloaded: !!meta,
      storedBytes: meta ? meta.bytes : 0,
      storedFiles: meta ? meta.files : 0,
      storedText: formatBytes(meta ? meta.bytes : 0)
    };
    if (!supported) return base;
    try {
      const m = await getManifest();
      base.totalBytes = m.totalBytes;
      base.totalFiles = m.totalFiles;
      base.totalText = formatBytes(m.totalBytes);
      base.groups = m.groups.map(g => ({
        id: g.id, label: g.label, bytes: g.bytes, text: formatBytes(g.bytes), files: g.files.length
      }));
    } catch (e) {
      // Offline and never synced: we genuinely don't know the size. Say so
      // rather than showing a made-up number.
      base.totalText = base.downloaded ? base.storedText : 'unknown';
    }
    return base;
  }

  /* ── Download ──────────────────────────────────────────────── */

  let running = false;
  const isRunning = () => running;

  /* Download everything in the manifest into the offline cache.
   *
   * onProgress({done, total, bytes, totalBytes, percent, label}) fires per file
   * so the caller can drive a progress bar. Resolves with a summary; individual
   * file failures are collected rather than aborting the run, because losing one
   * thumbnail should not cost you the other 468.
   */
  async function sync(onProgress) {
    if (!supported) throw new Error('This browser cannot store data for offline use.');
    if (running) throw new Error('A download is already running.');
    if (!navigator.onLine) throw new Error('You are offline. Connect to the internet and try again.');

    running = true;
    try {
      manifestCache = null; // always re-read: the point of syncing is getting the current list
      const m = await getManifest();
      const cache = await caches.open(CACHE);
      const files = m.groups.flatMap(g => g.files);
      const total = files.length;
      const totalBytes = m.totalBytes;

      let done = 0, bytes = 0;
      const failed = [];
      let cursor = 0;

      const report = (label) => {
        if (!onProgress) return;
        onProgress({
          done, total, bytes, totalBytes,
          percent: total ? Math.round((done / total) * 100) : 0,
          label: label || ''
        });
      };
      report('Starting…');

      async function worker() {
        while (cursor < files.length) {
          const file = files[cursor++];
          const url = abs(file.u);
          try {
            // cache:'reload' forces a real network hit, bypassing the HTTP
            // cache. Without it "Update data" could re-store the same stale
            // bytes it already had and report success.
            const res = await fetch(url, { cache: 'reload' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            await cache.put(url, res.clone());
            bytes += file.b;
          } catch (e) {
            failed.push(file.u);
          }
          done++;
          report(file.u.split('/').pop());
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, files.length) }, worker)
      );

      // Drop anything cached from a previous sync that is no longer in the
      // manifest (retired ship art), so deleted files don't accumulate forever.
      const wanted = new Set(files.map(f => abs(f.u)));
      const stale = (await cache.keys()).filter(req => !wanted.has(req.url));
      await Promise.all(stale.map(req => cache.delete(req)));

      const meta = {
        at: Date.now(),
        files: total - failed.length,
        bytes,
        failed: failed.length
      };
      writeMeta(meta);
      report('Done');
      return { ok: true, files: meta.files, total, bytes, failed, pruned: stale.length };
    } finally {
      running = false;
    }
  }

  /* ── Delete ────────────────────────────────────────────────── */

  // Removes the downloaded bundle only. Fleets (localStorage) and the app shell
  // (dfc-cache-vN) are untouched — deleting your downloaded ship art must never
  // cost you your saved lists.
  async function remove() {
    if (!supported) return { ok: false };
    const before = readMeta();
    await caches.delete(CACHE);
    clearMeta();
    return { ok: true, freed: before ? before.bytes : 0, freedText: formatBytes(before ? before.bytes : 0) };
  }

  /* ── Auto-sync ─────────────────────────────────────────────── */

  // Auto-download only on a connection we can positively identify as wifi.
  // Everywhere else (cellular, Data Saver, or a browser that won't tell us —
  // which includes every iPhone) it stays quiet and waits to be asked.
  const AUTO_STALE_MS = 7 * 24 * 60 * 60 * 1000; // a week
  let autoTried = false;

  function shouldAutoSync() {
    if (!supported || running || autoTried) return false;
    if (!isWifi()) return false;
    const meta = readMeta();
    if (!meta) return false;          // never opted in — don't decide for them
    return Date.now() - meta.at > AUTO_STALE_MS;
  }

  // Refreshes a bundle the user already chose to download, once it goes stale,
  // and only on wifi. It never starts a first-time download by itself: that is
  // a 26 MB decision and it belongs to the user.
  function maybeAutoSync(onDone) {
    if (!shouldAutoSync()) return false;
    autoTried = true;
    sync().then(
      r => { if (onDone) onDone(null, r); },
      e => { if (onDone) onDone(e); }
    );
    return true;
  }

  function init(onDone) {
    if (!supported) return;
    if (!maybeAutoSync(onDone)) {
      // Not eligible now (offline, or on cellular). Try again if the connection
      // comes back as wifi while the app is still open.
      window.addEventListener('online', () => { maybeAutoSync(onDone); }, { once: true });
    }
  }

  return {
    supported, status, sync, remove, init, maybeAutoSync,
    isRunning, connectionType, isWifi, formatBytes, formatWhen,
    CACHE_NAME: CACHE
  };
})();
