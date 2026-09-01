/* Fleet Sync — opt-in cross-device sync of the shared `dfc_fleets` list.
 *
 * Loaded by BOTH apps (index.html and mobile/index.html), same as offline-sync.js,
 * so the merge rules can never drift between desktop and phone.
 *
 * Design, and why it looks like this:
 *
 * - There is no account and no password. A Sync Token is a six-word phrase that
 *   doubles as the Firestore document ID. Knowing the phrase is the entire
 *   credential. This is deliberate (the user asked for no sign-in), and the app
 *   copy says so plainly, because anyone holding the token can read AND edit.
 *
 * - Talks to Firestore over its plain REST API rather than the Firebase SDK.
 *   The SDK is ~400 KB and would have to come from a CDN, which fights this
 *   app's offline-first service worker. `fetch` costs nothing and keeps the app
 *   dependency-free with no build step.
 *
 * - The whole fleet list travels as ONE JSON string in a single `payload` field.
 *   Firestore's REST format otherwise requires tagging every value with its type
 *   ({stringValue}, {integerValue}, nested {mapValue}...), which for deeply
 *   nested fleet objects would be a lot of pointless conversion code.
 *
 * - The API key below is not a secret. Firebase web keys ship in client JS by
 *   design; they identify the project, they do not authorise anything. Access is
 *   controlled entirely by firestore.rules in the repo root.
 *
 * Merge rules: union by fleet id, newest `updatedAt` wins on a collision, and
 * deletions travel as tombstones so a fleet deleted on one device does not come
 * back from the cloud on the next pull. Nothing is ever silently dropped.
 */
(function () {
  'use strict';

  const PROJECT = 'dropfleet-builder';
  const API_KEY = 'AIzaSyCuVs19-E131IHSZ_smWcLLl52djAZuJ60';
  const DOCS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
               '/databases/(default)/documents/';

  /* Two ways to sync, one merge engine.
   *
   *   token   -> /sync/{six-word-phrase}   the phrase IS the credential
   *   account -> /users/{uid}              a Google sign-in, no phrase to carry
   *
   * Signing in does not retire anybody's token: the token document is left
   * exactly where it is, so another device still holding it keeps working. It
   * only stops being THIS device's sync channel, because writing both would
   * make two documents race over one list. FleetSync.adoptToken() folds a
   * token's fleets into the account once, for the person who had a token first.
   */
  function signedInUid() {
    try {
      const u = window.FleetAuth && FleetAuth.user();
      return u ? u.uid : null;
    } catch (e) { return null; }
  }
  function mode() {
    if (signedInUid()) return 'account';
    if (token()) return 'token';
    return null;
  }

  const FLEETS_KEY  = 'dfc_fleets';        // shared with both apps
  const TOKEN_KEY   = 'dfc_sync_token';
  const DELETED_KEY = 'dfc_sync_deleted';  // { fleetId: deletedAt }
  const LASTSYNC_KEY = 'dfc_sync_last';

  /* ── Keeping the Dropzone builder's armies out ────────────────
   *
   * The Dropzone Commander builder is a page on type37.github.io, and so is
   * this. One origin means one localStorage, so it read this file's TOKEN_KEY
   * and considered itself switched on the moment sync was switched on here; it
   * also wrote to the same Firestore document. The merge below moves opaque
   * {id, updatedAt} records and never looks inside them, which is exactly why
   * it could not notice, so the two games' lists became one array: armies
   * turned up in the fleet list here, fleets turned up in the army list there.
   *
   * That app has moved to its own keys and its own document, so no more can
   * arrive. What is left is the armies that already did -- in localStorage, and
   * in this token's cloud copy, which would otherwise hand them back on every
   * pull. Both are cleaned below.
   *
   * The test is positive rather than "does not look like a fleet": an army has
   * a `groups` array, which nothing here has ever written. A fleet that somehow
   * lacks `battleGroups` is still a fleet and is left alone. */
  function isForeign(f) {
    return !!f && Array.isArray(f.groups) && !f.battleGroups;
  }

  // Runs at load, before app.js and mobile.js read the list (both entry points
  // load this file first), so neither ever sees an army.
  try {
    const raw = JSON.parse(localStorage.getItem(FLEETS_KEY) || '[]');
    if (Array.isArray(raw)) {
      const clean = raw.filter(f => !isForeign(f));
      if (clean.length !== raw.length) localStorage.setItem(FLEETS_KEY, JSON.stringify(clean));
    }
  } catch (e) { /* unreadable list; loadFleets will reset it */ }

  const WORDS_PER_TOKEN = 6;

  /* Wordlist for token phrases. Dropfleet/naval flavoured so a token reads like
   * it belongs to the app. Deliberately avoids near-homophones and words that
   * are easy to mishear when read aloud to someone.
   *
   * Strength: 6 words from these 304 gives 49.5 bits, i.e. ~7.9e14 possible
   * phrases. Every guess costs an HTTPS round trip, so an attacker managing
   * 1000 guesses per second would still average ~12,000 years to land one.
   * Accidental collisions between two users are likewise negligible.
   * If this list is ever edited, keep it long: shortening it weakens every
   * token issued afterwards. */
  const WORDS = (
    'abyss admiral aegis aether afterburn agile albion amber anchor anvil arc archer ' +
    'argent armour ashen asteroid atlas augur aurora azure ballast banner barrage basalt ' +
    'beacon bearing bellows bishop bastion blackout bolt bounty bracket breach bridge ' +
    'bronze bulwark burner cadence caldera cannon canopy capital captain cargo cascade ' +
    'catapult cinder cipher citadel cleave cobalt comet compass conduit convoy copper ' +
    'corona corsair cradle crater crimson crucible cruiser cutter cyclone dagger dawn ' +
    'deckhand deploy derelict diadem diode dockyard dorsal dreadnought drift driver ' +
    'dropship dusk dynamo echelon eclipse ember engine ensign epoch equinox escort ' +
    'exhaust falcon fathom ferrous fission flagship flare flotilla forge foundry ' +
    'frigate fulcrum furnace gambit gantry garrison gauntlet girder glacier gradient ' +
    'granite gravity gunnery halcyon hangar harbour harrier hazard helix helmsman ' +
    'herald hollow horizon hull ignition impulse ingot inland ironside jetty jovian ' +
    'keel kestrel keystone kiln lancer lantern lattice launch legion lighthouse ' +
    'lodestar longbow lumen lunar magnet mainsail mantle mariner marker marshal ' +
    'mercury meridian mesa monolith monsoon mortar muster nadir naval nebula nexus ' +
    'nickel nimbus nomad northern oculus offshore onyx orbit ordnance outpost ' +
    'overwatch paladin parallax parapet payload pennant perigee phalanx pilot pinnacle ' +
    'pioneer piston pivot plating plummet polaris portside prism prospect prow pulsar ' +
    'quarry quasar quiver radiant rampart ranger ravine reactor redoubt reef regent ' +
    'relay rescue reserve resolve retinue revenant ridge rifle rigging ripcord river ' +
    'rocket rudder ruin runway sable salvage sapper scaffold scarlet schooner scout ' +
    'sentinel sextant shadow shipyard shoal shroud signal silica siren skiff slipway ' +
    'solar sonar southern spanner sparrow spinnaker spire squall stanchion starboard ' +
    'stellar steward stockade stratum stronghold summit sundial surge swallow talon ' +
    'tandem tempest tender terminus thruster tidal timber titan tonnage topsail torrent ' +
    'trawler tremor trident triumph tundra turbine turret twilight umbra undertow ' +
    'valiant vanguard vector vellum venture vertex vessel viaduct vigil visor voltage ' +
    'voyager warden warrant watchman waypoint western wharf whistle winch windward ' +
    'wireframe wolfpack yardarm zenith zephyr zircon'
  ).split(' ').filter(Boolean);

  /* ── Local state ─────────────────────────────────────────── */
  function supported() {
    try { return !!(window.crypto && crypto.getRandomValues && window.fetch && localStorage); }
    catch (e) { return false; }
  }
  function token()   { try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; } }
  function enabled() { return mode() !== null; }
  function lastSync() {
    const v = parseInt(localStorage.getItem(LASTSYNC_KEY) || '0', 10);
    return v > 0 ? v : null;
  }

  function readLocal() {
    try { const a = JSON.parse(localStorage.getItem(FLEETS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeLocal(list) {
    localStorage.setItem(FLEETS_KEY, JSON.stringify(list));
    // A merge rewrites the whole list, so the change-detection baseline has to be
    // rebuilt from it. Without this the next saveFleets() would see every fleet
    // as "changed", stamp them all with now(), and let this device win every
    // future conflict regardless of who actually edited last.
    if (sigs) seedSigs();
  }
  function readDeleted() {
    try { const o = JSON.parse(localStorage.getItem(DELETED_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function writeDeleted(map) {
    localStorage.setItem(DELETED_KEY, JSON.stringify(map));
  }

  /* Both apps call this from their delete-fleet path. Without a tombstone the
   * next pull would helpfully restore the fleet the user just threw away. */
  function recordDeleted(id) {
    if (!id) return;
    const m = readDeleted();
    m[id] = Date.now();
    writeDeleted(m);
  }

  /* ── Change stamping ─────────────────────────────────────────
   * The merge decides a conflict with `updatedAt`, so every real edit MUST bump
   * it. The apps cannot be trusted to do that: between them there are 80+
   * saveFleets() call sites and only a handful set updatedAt. A fleet edited
   * without a bump would look old and could be overwritten by a stale copy from
   * another device, which is exactly the data loss this feature must not cause.
   *
   * So instead of stamping at 80 call sites, saveFleets() hands the list here and
   * we stamp whatever actually changed since the last save.
   *
   * Comparison uses a key-sorted serialisation with top-level `updatedAt`
   * excluded. Sorting matters: plain JSON.stringify would report a change
   * whenever key order shifted, and a false "this changed" would let an
   * untouched local fleet win a merge against a genuinely newer remote one. */
  function stableSig(v, dropUpdatedAt) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(x => stableSig(x, false)).join(',') + ']';
    const keys = Object.keys(v).filter(k => !(dropUpdatedAt && k === 'updatedAt')).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableSig(v[k], false)).join(',') + '}';
  }

  let sigs = null;
  function seedSigs() {
    sigs = {};
    readLocal().forEach(f => { if (f && f.id) sigs[f.id] = stableSig(f, true); });
  }

  /* Called at the top of saveFleets() in both apps. Mutates the fleets in place,
   * setting updatedAt on any that differ from their last-saved content. Returns
   * true if anything changed, so the caller can skip a pointless network sync. */
  function stampChanged(list) {
    if (!sigs) seedSigs();          // seeded from storage at load, so the first
                                    // save after an edit is correctly detected
    const now = Date.now();
    let changed = false;
    const seen = {};
    (list || []).forEach(f => {
      if (!f || !f.id) return;
      seen[f.id] = true;
      const sig = stableSig(f, true);
      if (sigs[f.id] !== sig) {
        f.updatedAt = now;
        sigs[f.id] = sig;
        changed = true;
      } else if (!f.updatedAt) {
        f.updatedAt = now;          // legacy fleet that never had a timestamp
      }
    });
    // A fleet that vanished from the list counts as a change (a delete).
    Object.keys(sigs).forEach(id => {
      if (!seen[id]) { delete sigs[id]; changed = true; }
    });
    return changed;
  }

  /* ── Tokens ──────────────────────────────────────────────── */
  function randomToken() {
    const buf = new Uint32Array(WORDS_PER_TOKEN);
    crypto.getRandomValues(buf);
    const out = [];
    for (let i = 0; i < WORDS_PER_TOKEN; i++) out.push(WORDS[buf[i] % WORDS.length]);
    return out.join('-');
  }

  /* Forgiving on input: users will paste with stray spaces, capitals, curly
   * punctuation from a messaging app, or commas instead of hyphens. */
  function normaliseToken(raw) {
    return String(raw || '').toLowerCase().replace(/[^a-z]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  function looksLikeToken(raw) {
    const t = normaliseToken(raw);
    return t.length >= 24 && t.split('-').filter(Boolean).length >= 4;
  }

  /* ── Firestore REST ──────────────────────────────────────── */
  const EMPTY = { fleets: [], deleted: {} };

  async function failure(res) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j && j.error && j.error.message) || '';
    } catch (e) {}
    if (res.status === 403) return new Error('Sync was refused by the server. ' + detail);
    if (res.status === 429) return new Error('Sync is busy, try again in a minute.');
    return new Error(detail || ('Sync failed (HTTP ' + res.status + ').'));
  }

  /* Where this device syncs right now, and what it must send to be let in.
   * Account mode carries a Firebase ID token; token mode carries nothing,
   * because in that model the document name is the whole credential. */
  async function target() {
    const uid = signedInUid();
    if (uid) {
      const t = await FleetAuth.idToken();
      if (t) return { path: 'users/' + uid, bearer: t };
      // Signed in but the token could not be refreshed (offline, most likely).
      // Fall through to the token path rather than syncing to nothing.
    }
    const tok = token();
    return tok ? { path: 'sync/' + tok, bearer: null } : null;
  }
  function tokenTarget(tok) { return { path: 'sync/' + tok, bearer: null }; }

  function docUrl(t) {
    return DOCS + t.path.split('/').map(encodeURIComponent).join('/') + '?key=' + API_KEY;
  }
  function authHeaders(t, extra) {
    const h = Object.assign({}, extra || {});
    if (t.bearer) h.Authorization = 'Bearer ' + t.bearer;
    return h;
  }

  async function remoteGet(t) {
    const res = await fetch(docUrl(t), { cache: 'no-store', headers: authHeaders(t) });
    if (res.status === 404) return null;          // never been written to
    if (!res.ok) throw await failure(res);
    const doc = await res.json();
    const raw = doc && doc.fields && doc.fields.payload && doc.fields.payload.stringValue;
    if (!raw) return EMPTY;
    try {
      const p = JSON.parse(raw);
      return {
        fleets: Array.isArray(p.fleets) ? p.fleets : [],
        deleted: (p.deleted && typeof p.deleted === 'object') ? p.deleted : {}
      };
    } catch (e) { return EMPTY; }
  }

  async function remotePut(t, payload) {
    const body = {
      fields: {
        payload:   { stringValue: JSON.stringify(payload) },
        updatedAt: { integerValue: String(Date.now()) },
        version:   { integerValue: '1' }
      }
    };
    // PATCH upserts in the Firestore REST API, so this both creates and updates.
    const res = await fetch(docUrl(t), {
      method: 'PATCH',
      headers: authHeaders(t, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await failure(res);
  }

  async function remoteDelete(t) {
    const res = await fetch(docUrl(t), { method: 'DELETE', headers: authHeaders(t) });
    if (!res.ok && res.status !== 404) throw await failure(res);
  }

  /* ── Merge ───────────────────────────────────────────────── */
  /* Union by id, newest updatedAt wins, tombstones applied last. A fleet with no
   * updatedAt is treated as age 0 so anything dated beats it. */
  function mergeWith(remote) {
    const byId = {};
    readLocal().forEach(f => { if (f && f.id) byId[f.id] = f; });

    (remote.fleets || []).forEach(f => {
      if (!f || !f.id) return;
      if (isForeign(f)) return;         // an army left in this token's cloud copy
      const mine = byId[f.id];
      if (!mine || (f.updatedAt || 0) > (mine.updatedAt || 0)) byId[f.id] = f;
    });

    // Tombstones from both sides, keeping the later timestamp for each id.
    const deleted = {};
    const localDel = readDeleted();
    [remote.deleted || {}, localDel].forEach(src => {
      Object.keys(src).forEach(id => {
        const t = parseInt(src[id], 10) || 0;
        if (t > (deleted[id] || 0)) deleted[id] = t;
      });
    });
    // A tombstone only wins if the fleet has not been edited since it was set,
    // so re-creating or editing a fleet on another device resurrects it on purpose.
    Object.keys(deleted).forEach(id => {
      const f = byId[id];
      if (f && (f.updatedAt || 0) <= deleted[id]) delete byId[id];
    });

    return { fleets: Object.keys(byId).map(k => byId[k]), deleted: deleted };
  }

  /* ── Public operations ───────────────────────────────────── */

  /* Look at a token without touching anything, so the modal can say
   * "that token has 6 fleets, this device has 3" before the user commits. */
  async function preview(raw) {
    const tok = normaliseToken(raw);
    const remote = await remoteGet(tokenTarget(tok));
    return {
      token: tok,
      exists: remote !== null,
      remoteCount: remote ? (remote.fleets || []).length : 0,
      localCount: readLocal().length
    };
  }

  /* Adopt a token: pull, merge into local, then push the merged result back so
   * every device converges on the same list. */
  async function join(raw) {
    const tok = normaliseToken(raw);
    if (!looksLikeToken(tok)) throw new Error('That does not look like a Sync Token.');
    const remote = (await remoteGet(tokenTarget(tok))) || EMPTY;
    const before = readLocal().length;
    const merged = mergeWith(remote);
    writeLocal(merged.fleets);
    writeDeleted(merged.deleted);
    localStorage.setItem(TOKEN_KEY, tok);
    await remotePut(tokenTarget(tok), merged);
    localStorage.setItem(LASTSYNC_KEY, String(Date.now()));
    return {
      token: tok,
      total: merged.fleets.length,
      fromToken: (remote.fleets || []).length,
      fromDevice: before
    };
  }

  /* Create a brand new token and upload this device's fleets to it. */
  async function start() {
    const tok = randomToken();
    return await join(tok);
  }

  /* Pull, merge, push. Used on app start and after local edits. Always reads
   * before writing so a stale device cannot clobber another device's work. */
  let inFlight = null;
  async function sync() {
    if (!enabled()) return null;
    if (inFlight) return inFlight;          // coalesce overlapping calls
    inFlight = (async () => {
      try {
        const t = await target();
        if (!t) return null;
        const remote = (await remoteGet(t)) || EMPTY;
        const beforeIds = readLocal().map(f => f && f.id).join(',');
        const merged = mergeWith(remote);
        writeLocal(merged.fleets);
        writeDeleted(merged.deleted);
        await remotePut(t, merged);
        localStorage.setItem(LASTSYNC_KEY, String(Date.now()));
        const changed = merged.fleets.map(f => f && f.id).join(',') !== beforeIds;
        if (changed && typeof api.onChange === 'function') api.onChange(merged.fleets);
        return { total: merged.fleets.length, changed: changed };
      } finally { inFlight = null; }
    })();
    return inFlight;
  }

  /* Debounced sync for "keep both in step" after an edit. Failures are swallowed
   * on purpose: a background sync must never interrupt list building, and the
   * next change (or next app start) retries.
   *
   * Also rate limited. The free Firestore tier has a hard daily write allowance,
   * and building a list is a burst activity: adding eight ships to a battlegroup
   * is eight saves. Without a floor between automatic syncs, heavy list building
   * (or a future bug that calls saveFleets in a loop) could spend the day's quota
   * and take sync down for everyone until it resets. This is the cheap version of
   * what App Check would guard against, with no extra dependencies.
   *
   * The floor applies ONLY to automatic syncs. "Sync now" is an explicit request
   * and always goes through immediately. */
  const MIN_AUTO_GAP = 15000;
  let timer = null;
  function notifyChanged(delay) {
    if (!enabled()) return;
    const base = delay == null ? 2500 : delay;
    const since = Date.now() - (lastSync() || 0);
    const wait = Math.max(base, MIN_AUTO_GAP - since);
    clearTimeout(timer);
    timer = setTimeout(() => { sync().catch(() => {}); }, wait);
  }

  /* Stop syncing on THIS device only. The token and its cloud copy survive, so
   * the user can rejoin later or keep using it elsewhere. Local fleets are kept. */
  function stop() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LASTSYNC_KEY);
    clearTimeout(timer);
  }

  /* Erase the cloud copy outright, then stop syncing here. Local fleets are
   * still kept: this deletes the online copy, not the user's work. Any other
   * device still holding the token keeps its own local fleets too, and would
   * re-upload them if it syncs again, so the copy on this device going away is
   * not the same as the token being retired everywhere. */
  async function deleteRemote() {
    const t = await target();
    if (!t) return false;
    await remoteDelete(t);
    // Signing out is the user's own decision, so an account keeps its session
    // and simply has nothing stored online any more. A token has no meaning
    // once its document is gone, so that one is dropped from this device.
    if (mode() === 'token') stop();
    else localStorage.removeItem(LASTSYNC_KEY);
    return true;
  }

  /* One-time merge for somebody who used a Sync Token before they signed in.
   * Reads the token's document, folds it into the local list, pushes the result
   * to the account, and stops this device syncing on the token. The token's own
   * document is left alone: other devices still holding it keep working. */
  async function adoptToken(raw) {
    if (mode() !== 'account') throw new Error('Sign in first.');
    const tok = normaliseToken(raw || token() || '');
    if (!looksLikeToken(tok)) throw new Error('That does not look like a Sync Token.');
    const remote = (await remoteGet(tokenTarget(tok))) || EMPTY;
    const before = readLocal().length;
    const merged = mergeWith(remote);
    writeLocal(merged.fleets);
    writeDeleted(merged.deleted);
    localStorage.removeItem(TOKEN_KEY);
    const t = await target();
    if (t) await remotePut(t, merged);
    localStorage.setItem(LASTSYNC_KEY, String(Date.now()));
    if (typeof api.onChange === 'function') api.onChange(merged.fleets);
    return { total: merged.fleets.length, fromToken: (remote.fleets || []).length, fromDevice: before };
  }

  /* ── Staying in step ─────────────────────────────────────────
   * A device syncs on app start and after its own edits, but that leaves the
   * obvious gap: a phone sitting open while you edit on the desktop has no
   * reason to look again, so it quietly shows a stale list.
   *
   * Closed with events rather than polling. Polling on a timer would spend the
   * free tier's daily reads doing nothing useful, and would keep a phone's radio
   * awake at a table. These three cover what actually happens in practice:
   *
   *   visibilitychange  you switch back to the app (the big one on a phone,
   *                     where you are constantly leaving and returning)
   *   focus             same idea on a desktop with the app in a background tab
   *   online            signal came back, which is the games-hall case: the app
   *                     is already open and reconnects
   *
   * All three go through the same MIN_AUTO_GAP floor, so flicking between apps
   * cannot turn into a burst of writes. */
  function maybeAutoSync() {
    if (!enabled()) return;
    if (Date.now() - (lastSync() || 0) < MIN_AUTO_GAP) return;
    sync().catch(() => {});
  }
  try {
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') maybeAutoSync();
      });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', maybeAutoSync);
      window.addEventListener('online', maybeAutoSync);
    }
  } catch (e) { /* non-browser host (the test sandbox); nothing to attach to */ }

  const api = {
    supported, enabled, token, lastSync,
    randomToken, normaliseToken, looksLikeToken,
    mode, preview, join, start, sync, notifyChanged, maybeAutoSync, stop, deleteRemote, recordDeleted,
    adoptToken,
    stampChanged,
    wordCount: WORDS.length,
    WORDS_PER_TOKEN: WORDS_PER_TOKEN,
    onChange: null           // apps assign a re-render callback
  };
  window.FleetSync = api;
})();
