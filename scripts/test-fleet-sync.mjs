/* Merge-logic tests for js/fleet-sync.js.
 *
 * The merge decides whether a user keeps or loses a fleet list, so it gets
 * tested directly rather than only through the UI. Runs the real file in a
 * stubbed browser: fake localStorage, fake crypto, fake fetch.
 *
 *   node scripts/test-fleet-sync.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../js/fleet-sync.js', import.meta.url), 'utf8');

/* `seed` is written before the module runs, which is the only way to test what
   it does at load time -- the eviction of Dropzone armies happens there and
   nowhere else, because app.js and mobile.js both read the list straight from
   localStorage after this file has loaded. */
function makeSandbox(seed) {
  const store = new Map(Object.entries(seed || {}));
  const remote = { doc: null };     // the single /sync/{token} document
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const win = {};
  const sandbox = {
    window: win,
    localStorage,
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (i * 2654435761 + 12345) >>> 0; return a; } },
    setTimeout, clearTimeout, console,
    fetch: async (url, opts) => {
      if (opts && opts.method === 'PATCH') {
        remote.doc = JSON.parse(opts.body);
        return { ok: true, status: 200 };
      }
      if (opts && opts.method === 'DELETE') {
        remote.doc = null;
        return { ok: true, status: 200 };
      }
      if (!remote.doc) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => remote.doc };
    }
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  // `sandbox` is returned so a test can wrap its fetch: the module resolves the
  // global at call time, so patching sandbox.fetch intercepts real traffic.
  // Patching the returned wrapper object instead would silently do nothing.
  return { FleetSync: win.FleetSync, store, remote, localStorage, sandbox };
}

const fleets = j => JSON.parse(j || '[]');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  ->  ' + extra : '')); }
}

/* The exact scenario the user specified: laptop has 6, phone has 3, phone
   enters the laptop's token, phone must end up with 9. */
console.log('\nunion on first join (6 cloud + 3 local = 9)');
{
  const laptop = makeSandbox();
  const six = Array.from({ length: 6 }, (_, i) => ({ id: 'L' + i, name: 'Laptop ' + i, updatedAt: 1000 }));
  laptop.localStorage.setItem('dfc_fleets', JSON.stringify(six));
  const res = await laptop.FleetSync.start();
  check('laptop uploads 6', res.total === 6, 'got ' + res.total);

  // Same cloud document, different device with its own 3 fleets.
  const phone = makeSandbox();
  phone.remote.doc = laptop.remote.doc;
  const three = Array.from({ length: 3 }, (_, i) => ({ id: 'P' + i, name: 'Phone ' + i, updatedAt: 2000 }));
  phone.localStorage.setItem('dfc_fleets', JSON.stringify(three));
  const joined = await phone.FleetSync.join(res.token);
  check('phone shows 9', joined.total === 9, 'got ' + joined.total);
  check('counts reported for the modal', joined.fromToken === 6 && joined.fromDevice === 3,
        'fromToken=' + joined.fromToken + ' fromDevice=' + joined.fromDevice);
  const names = fleets(phone.store.get('dfc_fleets')).map(f => f.id).sort().join(',');
  check('all 9 ids present', names === 'L0,L1,L2,L3,L4,L5,P0,P1,P2', names);
}

console.log('\nnewest edit wins on the same fleet id');
{
  const a = makeSandbox();
  a.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'X', name: 'old', updatedAt: 100 }]));
  const { token } = await a.FleetSync.start();

  const b = makeSandbox();
  b.remote.doc = a.remote.doc;
  b.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'X', name: 'NEWER', updatedAt: 999 }]));
  await b.FleetSync.join(token);
  const got = fleets(b.store.get('dfc_fleets'));
  check('local newer edit survives', got.length === 1 && got[0].name === 'NEWER', JSON.stringify(got));

  // And the reverse: cloud newer than local.
  const c = makeSandbox();
  c.remote.doc = b.remote.doc;
  c.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'X', name: 'stale', updatedAt: 5 }]));
  await c.FleetSync.join(token);
  const got2 = fleets(c.store.get('dfc_fleets'));
  check('cloud newer edit wins', got2.length === 1 && got2[0].name === 'NEWER', JSON.stringify(got2));
}

console.log('\ndeleted fleets stay deleted (no zombies)');
{
  const a = makeSandbox();
  a.localStorage.setItem('dfc_fleets', JSON.stringify([
    { id: 'keep', name: 'keep', updatedAt: 100 },
    { id: 'gone', name: 'gone', updatedAt: 100 }
  ]));
  const { token } = await a.FleetSync.start();

  // Delete on this device the way the apps will: drop it, tombstone it, sync.
  a.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'keep', name: 'keep', updatedAt: 100 }]));
  a.FleetSync.recordDeleted('gone');
  await a.FleetSync.sync();
  check('deleting device keeps 1', fleets(a.store.get('dfc_fleets')).length === 1);

  // A second device that still has the old copy must not push it back.
  const b = makeSandbox();
  b.remote.doc = a.remote.doc;
  b.localStorage.setItem('dfc_fleets', JSON.stringify([
    { id: 'keep', name: 'keep', updatedAt: 100 },
    { id: 'gone', name: 'gone', updatedAt: 100 }
  ]));
  await b.FleetSync.join(token);
  const ids = fleets(b.store.get('dfc_fleets')).map(f => f.id);
  check('tombstone removes it on the other device too', ids.length === 1 && ids[0] === 'keep', ids.join(','));

  // But editing it again after the delete is a deliberate revival.
  const c = makeSandbox();
  c.remote.doc = b.remote.doc;
  c.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'gone', name: 'revived', updatedAt: Date.now() + 5000 }]));
  await c.FleetSync.join(token);
  const revived = fleets(c.store.get('dfc_fleets')).some(f => f.id === 'gone');
  check('a later edit resurrects on purpose', revived);
}

console.log('\ntokens');
{
  const s = makeSandbox();
  const t = s.FleetSync.randomToken();
  check('six words', t.split('-').length === 6, t);
  check('lowercase letters and hyphens only', /^[a-z]+(-[a-z]+){5}$/.test(t), t);
  check('clears the rules length floor (>=24)', t.length >= 24, t.length + ' chars: ' + t);
  check('wordlist is large', s.FleetSync.wordCount >= 300, String(s.FleetSync.wordCount));

  // Messy paste handling: caps, spaces, commas, stray punctuation.
  const messy = '  Anvil, Drift  OCULUS—vessel amber.forge ';
  check('normalises a messy paste', s.FleetSync.normaliseToken(messy) === 'anvil-drift-oculus-vessel-amber-forge',
        s.FleetSync.normaliseToken(messy));
  check('rejects obvious junk', !s.FleetSync.looksLikeToken('test'));
  check('accepts a real token', s.FleetSync.looksLikeToken(t));
}

console.log('\nunused token is not an error');
{
  const s = makeSandbox();
  const p = await s.FleetSync.preview('anvil-drift-oculus-vessel-amber-forge');
  check('preview reports it does not exist yet', p.exists === false && p.remoteCount === 0);
  s.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', updatedAt: 1 }]));
  const j = await s.FleetSync.join('anvil-drift-oculus-vessel-amber-forge');
  check('joining a fresh token keeps local fleets', j.total === 1, 'got ' + j.total);
}

console.log('\nstop() keeps fleets, drops the token');
{
  const s = makeSandbox();
  s.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', updatedAt: 1 }, { id: 'B', updatedAt: 1 }]));
  await s.FleetSync.start();
  check('enabled while syncing', s.FleetSync.enabled());
  s.FleetSync.stop();
  check('disabled after stop', !s.FleetSync.enabled());
  check('fleets untouched by stop', fleets(s.store.get('dfc_fleets')).length === 2);
}

console.log('\ndeleteRemote erases the cloud copy but never the local fleets');
{
  const s = makeSandbox();
  s.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', updatedAt: 1 }, { id: 'B', updatedAt: 1 }]));
  await s.FleetSync.start();
  check('cloud doc exists first', s.remote.doc !== null);
  await s.FleetSync.deleteRemote();
  check('cloud doc gone', s.remote.doc === null);
  check('local fleets survive the cloud delete', fleets(s.store.get('dfc_fleets')).length === 2);
  check('syncing is off afterwards', !s.FleetSync.enabled());
}

/* The apps have 80+ saveFleets() call sites and almost none set updatedAt, so
   stampChanged is what actually keeps the merge honest. If it under-stamps, an
   edit can be overwritten by a stale copy. If it over-stamps, an untouched
   fleet wins a merge it should have lost. Both lose someone's work. */
console.log('\nstampChanged detects real edits and ignores non-edits');
{
  const s = makeSandbox();
  const list = [{ id: 'A', name: 'Alpha', updatedAt: 100 }, { id: 'B', name: 'Beta', updatedAt: 100 }];
  s.localStorage.setItem('dfc_fleets', JSON.stringify(list));

  const noop = s.FleetSync.stampChanged(JSON.parse(JSON.stringify(list)));
  check('no edit means no change reported', noop === false, String(noop));

  const edited = JSON.parse(JSON.stringify(list));
  edited[0].name = 'Alpha Renamed';
  const did = s.FleetSync.stampChanged(edited);
  check('an edit is reported', did === true);
  check('the edited fleet is stamped', edited[0].updatedAt > 100, String(edited[0].updatedAt));
  check('the untouched fleet is NOT stamped', edited[1].updatedAt === 100, String(edited[1].updatedAt));

  // Key order must not count as an edit: a false positive would let this stale
  // copy beat a genuinely newer one from another device.
  const reordered = [{ updatedAt: edited[0].updatedAt, name: 'Alpha Renamed', id: 'A' },
                     { name: 'Beta', updatedAt: 100, id: 'B' }];
  check('key reordering is not an edit', s.FleetSync.stampChanged(reordered) === false);

  // A deletion counts as a change so the sync gets triggered.
  check('removing a fleet is reported', s.FleetSync.stampChanged([reordered[0]]) === true);

  // A legacy fleet with no timestamp at all gets one.
  const legacy = [{ id: 'C', name: 'No timestamp' }];
  s.FleetSync.stampChanged(legacy);
  check('legacy fleet gains a timestamp', typeof legacy[0].updatedAt === 'number');
}

console.log('\na merge does not make every fleet look freshly edited');
{
  // Regression guard: after join() rewrites local storage, the change-detection
  // baseline must be rebuilt, or the next save stamps everything with now() and
  // this device wins every future conflict.
  const a = makeSandbox();
  a.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', name: 'a', updatedAt: 100 }]));
  const { token } = await a.FleetSync.start();

  const b = makeSandbox();
  b.remote.doc = a.remote.doc;
  b.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'B', name: 'b', updatedAt: 200 }]));
  b.FleetSync.stampChanged(JSON.parse(b.store.get('dfc_fleets')));   // establish baseline
  await b.FleetSync.join(token);

  const after = fleets(b.store.get('dfc_fleets'));
  check('merged to 2 fleets', after.length === 2, String(after.length));
  const restamped = b.FleetSync.stampChanged(after);
  check('post-merge save reports no spurious edits', restamped === false, String(restamped));
  check('timestamps survive the merge untouched',
        after.every(f => f.updatedAt === 100 || f.updatedAt === 200),
        JSON.stringify(after.map(f => f.updatedAt)));
}

/* Building a list is bursty: adding eight ships is eight saves. Automatic syncs
   must be spaced so heavy list building cannot spend the free tier's daily write
   allowance and take sync down until it resets. */
console.log('\nautomatic syncs are rate limited, manual ones are not');
{
  const s = makeSandbox();
  s.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', updatedAt: 1 }]));
  await s.FleetSync.start();

  // Count writes reaching the network. Must patch the SANDBOX global, not the
  // returned wrapper, or the module keeps using the original fetch.
  let writes = 0;
  const realFetch = s.sandbox.fetch;
  s.sandbox.fetch = async (url, opts) => {
    if (opts && opts.method === 'PATCH') writes++;
    return realFetch(url, opts);
  };

  // A burst of 20 edits must collapse into far fewer network writes.
  for (let i = 0; i < 20; i++) s.FleetSync.notifyChanged(1);
  await new Promise(r => setTimeout(r, 300));
  check('a 20-edit burst does not become 20 writes', writes <= 1, 'writes=' + writes);

  // An explicit "Sync now" is never delayed.
  const before = writes;
  await s.FleetSync.sync();
  check('manual sync always goes through', writes === before + 1, 'writes=' + writes);
}

/* Returning to the app is what makes sync feel continuous: a phone sitting open
   while you edit on the desktop has no other reason to look again. But it must
   not turn app-switching into a burst of writes. */
console.log('\nreturning to the app re-syncs, but not in a burst');
{
  const s = makeSandbox();
  s.localStorage.setItem('dfc_fleets', JSON.stringify([{ id: 'A', updatedAt: 1 }]));
  await s.FleetSync.start();

  let writes = 0;
  const realFetch = s.sandbox.fetch;
  s.sandbox.fetch = async (url, opts) => {
    if (opts && opts.method === 'PATCH') writes++;
    return realFetch(url, opts);
  };

  // Just came back from another app, but a sync happened moments ago.
  s.FleetSync.maybeAutoSync();
  await new Promise(r => setTimeout(r, 150));
  check('does not re-sync straight after syncing', writes === 0, 'writes=' + writes);

  // Now pretend the last sync was long ago: coming back SHOULD refresh.
  s.localStorage.setItem('dfc_sync_last', String(Date.now() - 120000));
  s.FleetSync.maybeAutoSync();
  await new Promise(r => setTimeout(r, 200));
  check('re-syncs when the data could be stale', writes === 1, 'writes=' + writes);

  // Flicking between apps repeatedly must not stack up writes.
  for (let i = 0; i < 10; i++) s.FleetSync.maybeAutoSync();
  await new Promise(r => setTimeout(r, 200));
  check('ten app switches do not become ten writes', writes === 1, 'writes=' + writes);

  // And it stays quiet entirely when the user never opted in.
  const off = makeSandbox();
  let offWrites = 0;
  const offFetch = off.sandbox.fetch;
  off.sandbox.fetch = async (u, o) => { if (o && o.method === 'PATCH') offWrites++; return offFetch(u, o); };
  off.FleetSync.maybeAutoSync();
  await new Promise(r => setTimeout(r, 150));
  check('silent when syncing is off', offWrites === 0, 'writes=' + offWrites);
}

/* The Dropzone Commander builder is a page on type37.github.io and so is this,
   so they share an origin, one localStorage and -- until that app moved to keys
   and a document of its own -- one sync document. The merge moves opaque
   records and never looks inside them, so the two games' lists became one:
   armies landed in the fleet list here. No more can arrive; these keep out the
   ones that already did, from both places they are sitting in. */
console.log('\nDropzone armies stay out of the fleet list');
{
  const army = { id: 'A1', name: 'UCM army', faction: 'ucm', groups: [], commanders: [], updatedAt: 500 };
  const fleet = { id: 'F1', name: 'UCM fleet', faction: 'ucm', battleGroups: [], admirals: [], updatedAt: 100 };

  // Sitting in localStorage from the shared-key days.
  const s = makeSandbox({ dfc_fleets: JSON.stringify([fleet, army]) });
  const kept = fleets(s.store.get('dfc_fleets'));
  check('the army is evicted at load', kept.length === 1, JSON.stringify(kept.map(f => f.id)));
  check('the fleet is untouched', kept[0].id === 'F1');

  // And sitting in this token's cloud copy, which would hand it back on every
  // pull. Merging must drop it AND write the cleaned list back up.
  const c = makeSandbox({ dfc_fleets: JSON.stringify([fleet]) });
  c.remote.doc = { fields: { payload: { stringValue: JSON.stringify({ fleets: [fleet, army], deleted: {} }) } } };
  await c.FleetSync.join('anvil-drift-oculus-vessel-amber-forge');
  const after = fleets(c.store.get('dfc_fleets'));
  check('a pull does not bring the army back', after.length === 1, JSON.stringify(after.map(f => f.id)));
  const uploaded = JSON.parse(c.remote.doc.fields.payload.stringValue).fleets;
  check('and the cloud copy is cleaned too', uploaded.length === 1 && uploaded[0].id === 'F1',
        JSON.stringify(uploaded.map(f => f.id)));
}

/* The test is "looks like an army", not "does not look like a fleet". A fleet
   that somehow lacks battleGroups is still a fleet, and throwing one away would
   be the same data loss this whole file exists to prevent. */
console.log('\na fleet missing battleGroups is still a fleet');
{
  const odd = { id: 'F2', name: 'half-built', faction: 'scourge', admirals: [], updatedAt: 1 };
  const s = makeSandbox({ dfc_fleets: JSON.stringify([odd]) });
  check('it is kept', fleets(s.store.get('dfc_fleets')).length === 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
