/* Discord sign-in + linked Sync Token tests. Run via scripts/test-fleet-sync.mjs. */
export async function run({ vm, SRC, fleets, check }) {
/* ── Discord sign-in alongside Sync Tokens ─────────────────────
   Several devices, one fake Firestore with a document per path. A device that
   signs in with Discord keeps its old token linked, so devices still on the
   token and devices on Discord must end up with one list, never two. */
function makeDevice(docs, opts) {
  opts = opts || {};
  const store = new Map(Object.entries(opts.seed || {}));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const loc = { hash: opts.hash || '', pathname: '/dropfleet-builder/', search: '', href: 'https://x/dropfleet-builder/' + (opts.hash || '') };
  const win = {};
  let n = opts.rand || 1;
  const sandbox = {
    window: win, localStorage, location: loc,
    history: { replaceState: () => { loc.hash = ''; } },
    URLSearchParams,
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (n++ * 2654435761) >>> 0; return a; } },
    setTimeout, clearTimeout, console,
    fetch: async (url, o) => {
      const path = decodeURIComponent(url.split('/documents/')[1].split('?')[0]);
      if (o && o.method === 'PATCH') { docs[path] = JSON.parse(o.body); return { ok: true, status: 200 }; }
      if (o && o.method === 'DELETE') { delete docs[path]; return { ok: true, status: 200 }; }
      if (!docs[path]) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => docs[path] };
    }
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  const FS = win.FleetSync;
  return {
    FS, store,
    ids: () => fleets(store.get('dfc_fleets')).map(f => f.id).sort().join(','),
    add: (id, at) => {
      const l = fleets(store.get('dfc_fleets'));
      l.push({ id, name: id, battleGroups: [], updatedAt: at });
      store.set('dfc_fleets', JSON.stringify(l));
    }
  };
}
const KEY = 'discord-' + ['abcdabcdabcdabcd', 'efghefghefghefgh', 'ijklijklijklijkl', 'mnopmnopmnopmnop'].join('-');
const docIds = d => d ? JSON.parse(d.fields.payload.stringValue).fleets.map(f => f.id).sort().join(',') : null;
// A return from Discord: the nonce the device stored, the key, a name.
const discordReturn = nonce => '#dsync=' + KEY + '&ds=' + nonce + '&dn=Jet&da=';
const seedOf = d => Object.fromEntries(d.store);

console.log('\nDiscord sign-in keeps an old Sync Token linked');
{
  const docs = {};
  // Phone and PC both on phrase P.
  const phone = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'A', battleGroups: [], updatedAt: 1 }]) } });
  const P = (await phone.FS.start()).token;
  const pc0 = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'PC1', battleGroups: [], updatedAt: 2 }]), dfc_discord_state: 'n1' } });
  await pc0.FS.join(P);
  check('PC and phone share phrase P', docIds(docs['sync/' + P]) === 'A,PC1');

  // Phone saves B after the PC's last sync, then the PC signs in with Discord.
  phone.add('B', 5); await phone.FS.sync();
  const pc = makeDevice(docs, { seed: seedOf(pc0), hash: discordReturn('n1') });
  const r = await pc.FS.discordFinish();
  check('sign-in reports the name', r && r.name === 'Jet');
  check('PC is signed in with Discord', !!pc.FS.discordUser() && pc.FS.token() === KEY);
  check('old phrase is linked', pc.FS.linkedToken() === P);
  check('PC pulled B from the phrase on sign-in', pc.ids() === 'A,B,PC1', pc.ids());
  check('Discord copy has everything', docIds(docs['sync/' + KEY]) === 'A,B,PC1', docIds(docs['sync/' + KEY]));

  // Both directions keep flowing.
  phone.add('C', 10); await phone.FS.sync();
  await pc.FS.sync();
  check('phone fleet reaches the PC', pc.ids().includes('C'));
  check('...and the Discord copy', docIds(docs['sync/' + KEY]).includes('C'));
  pc.add('D', 11); await pc.FS.sync();
  await phone.FS.sync();
  check('PC fleet reaches the phone on the phrase', phone.ids().includes('D'), phone.ids());

  // A second Discord device with no token of its own.
  const laptop = makeDevice(docs, { seed: { dfc_discord_state: 'n2' }, hash: discordReturn('n2') });
  await laptop.FS.discordFinish();
  check('fresh Discord device gets the full list', laptop.ids() === 'A,B,C,D,PC1', laptop.ids());
  check('fresh Discord device has no link', laptop.FS.linkedToken() === null);
  laptop.add('E', 12); await laptop.FS.sync();
  await pc.FS.sync(); await phone.FS.sync();
  check('laptop fleet reaches the phone via the PC', phone.ids().includes('E'), phone.ids());

  // A deletion on the phone travels to Discord devices.
  phone.store.set('dfc_fleets', JSON.stringify(fleets(phone.store.get('dfc_fleets')).filter(f => f.id !== 'A')));
  phone.FS.recordDeleted('A');
  await phone.FS.sync(); await pc.FS.sync(); await laptop.FS.sync();
  check('deleting on the phone removes it everywhere', !pc.ids().includes('A') && !laptop.ids().includes('A'), pc.ids() + ' / ' + laptop.ids());

  // Signing out keeps the fleets on the device and stops syncing.
  const kept = pc.ids();
  pc.FS.discordSignOut();
  check('sign-out keeps local fleets', pc.ids() === kept);
  check('sign-out stops sync and drops the link', !pc.FS.enabled() && pc.FS.linkedToken() === null);
}

console.log('\nDiscord sign-in refuses a return it did not start');
{
  const docs = {};
  const d = makeDevice(docs, { seed: { dfc_discord_state: 'mine', dfc_fleets: '[]' }, hash: discordReturn('someone-else') });
  let err = null;
  try { await d.FS.discordFinish(); } catch (e) { err = e; }
  check('wrong nonce is rejected', !!err);
  check('nothing was joined', !d.FS.enabled() && !docs['sync/' + KEY]);
  const plain = makeDevice(docs, {});
  check('an ordinary load is not a Discord return', plain.FS.discordFinish() === null);
}

console.log('\nDelete online copy removes the linked copy too');
{
  const docs = {};
  const a = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'X', battleGroups: [], updatedAt: 1 }]), dfc_discord_state: 'n' } });
  const P = (await a.FS.start()).token;
  const b = makeDevice(docs, { seed: seedOf(a), hash: discordReturn('n') });
  await b.FS.discordFinish();
  check('two copies exist', !!docs['sync/' + P] && !!docs['sync/' + KEY]);
  await b.FS.deleteRemote();
  check('both copies gone', !docs['sync/' + P] && !docs['sync/' + KEY]);
  check('local fleets kept', b.ids() === 'X');
}

console.log('\nA linked copy deleted elsewhere is not brought back');
{
  const docs = {};
  const a = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'X', battleGroups: [], updatedAt: 1 }]), dfc_discord_state: 'n' } });
  const P = (await a.FS.start()).token;
  const b = makeDevice(docs, { seed: seedOf(a), hash: discordReturn('n') });
  await b.FS.discordFinish();
  await a.FS.deleteRemote();          // the phone deletes the phrase copy
  await b.FS.sync();
  check('phrase copy stays deleted', !docs['sync/' + P]);
  check('link dropped', b.FS.linkedToken() === null);
  check('Discord copy still has the fleets', docIds(docs['sync/' + KEY]) === 'X');
}

console.log('\nJoining a phrase by hand leaves Discord on that device');
{
  const docs = {};
  const a = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'X', battleGroups: [], updatedAt: 1 }]), dfc_discord_state: 'n' }, hash: discordReturn('n') });
  await a.FS.discordFinish();
  const other = makeDevice(docs, { seed: { dfc_fleets: JSON.stringify([{ id: 'Y', battleGroups: [], updatedAt: 1 }]) } });
  const Q = (await other.FS.start()).token;
  await a.FS.join(Q);
  check('device is on the phrase', a.FS.token() === Q && !a.FS.discordUser());
  check('nothing lost locally', a.ids() === 'X,Y', a.ids());
  check('Discord copy untouched', docIds(docs['sync/' + KEY]) === 'X');
}

}
