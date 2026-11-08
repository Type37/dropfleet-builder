// Photos of your own models, one per ship class, kept in this browser only
// (IndexedDB, far roomier than localStorage). Desktop and mobile are the same
// origin, so they share the one database. A photo is shrunk to a JPEG before it
// is stored, so a phone camera's 5 MB original costs about 100 KB.
//
// ShipPhotos.get() is synchronous (reads a cache filled at load) because the
// collection grid and the print sheet are built as plain strings.
(function () {
  const DB_NAME = 'dfc_photos';
  const STORE = 'photos';
  const MAX_SIDE = 900;
  const cache = new Map();
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function run(mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const keyOf = (faction, shipKey) => `${faction}:${shipKey}`;

  const ready = run('readonly', store => {
    const keys = store.getAllKeys();
    const vals = store.getAll();
    return { keys, vals };
  }).then(({ keys, vals }) => {
    (keys.result || []).forEach((k, i) => cache.set(k, vals.result[i]));
  }).catch(() => {});

  // File -> JPEG data URL, longest side MAX_SIDE. Browsers apply the camera's
  // EXIF rotation when an <img> is drawn, so portrait shots stay upright.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
      img.src = url;
    });
  }

  function get(faction, shipKey) {
    return cache.get(keyOf(faction, shipKey)) || null;
  }

  function set(faction, shipKey, file) {
    return shrink(file).then(dataUrl => {
      const k = keyOf(faction, shipKey);
      return run('readwrite', store => store.put(dataUrl, k)).then(() => {
        cache.set(k, dataUrl);
        return dataUrl;
      });
    });
  }

  function remove(faction, shipKey) {
    const k = keyOf(faction, shipKey);
    return run('readwrite', store => store.delete(k)).then(() => { cache.delete(k); });
  }

  // Opens the file chooser (on a phone: camera or library) and stores the pick.
  // Resolves with the stored data URL, or null when nothing was chosen.
  function pick(faction, shipKey) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) { resolve(null); return; }
        set(faction, shipKey, file).then(resolve, reject);
      }, { once: true });
      input.click();
    });
  }

  window.ShipPhotos = { ready, get, set, remove, pick };
})();
