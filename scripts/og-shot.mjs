#!/usr/bin/env node
/* Shoot the 1200x630 Open Graph card straight out of the running app.
 *
 * A link preview is the only picture of this app most people ever see, so it is
 * a picture of the app: a real fleet open in the Builder, not a wordmark on a
 * background. It replaces scripts/gen-og-image.py, which drew a Deco banner in
 * Pillow -- handsome, and a picture of nothing.
 *
 * Driven over Chrome's own DevTools Protocol, no dependencies -- same approach
 * as the Dropfleet/Dropzone shots.mjs harness. Node 22+ ships the WebSocket
 * client this needs.
 *
 *   node scripts/og-shot.mjs [baseUrl]
 *
 * WHY THE VIEWPORT IS 1280x672 AND NOT 1200x630
 *
 * The card is 1200x630. The page is laid out at 1280x672 -- the same 1.905
 * aspect -- shot at deviceScaleFactor 2, and the 2560x1344 result is
 * downsampled to 1200x630. Capturing at 2x and fitting down is what keeps the
 * type crisp; the width is chosen so the builder still lays out in its desktop
 * panes rather than dropping to the stacked narrow arrangement.
 */
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'https://type37.github.io/dropfleet-builder/';
const OUT = join(ROOT, 'assets', 'logos', 'og-preview.png');
const PROFILE = join(process.env.TEMP || '/tmp', 'dfc-og-profile');
const PORT = 9343;
const VIEW = { width: 1280, height: 672, deviceScaleFactor: 2, mobile: false };
const CARD = { width: 1200, height: 630 };

const CHROME = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium',
].filter(Boolean);

/* Getting to the picture. Everything is found by its rendered text rather than
 * by a class where it can be, so a restyle fails loudly rather than silently
 * shooting the wrong screen.
 *
 * The fleet is one of the app's own Fast Play Sheets rather than a hand-built
 * list, so the card cannot drift away from the data the app ships, and it is
 * loaded through the button a person actually clicks rather than through the
 * internals. UCM because it is the faction a stranger to the game meets first.
 */
const SEED = `
  const byText = (sel, re) => [...document.querySelectorAll(sel)]
    .find((e) => re.test((e.textContent || '').trim()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  App.navigate('fleets');
  await wait(700);
  App.showFleetTab('fastplay');
  await wait(800);

  const btn = byText('.fastplay-faction-btn', /^UCM/);
  if (!btn) throw new Error('no UCM Fast Play Sheet button');
  btn.click();
  await wait(2600);

  if (!/^#builder/.test(location.hash)) throw new Error('did not land in the builder');

  /* Give the fleet an Admiral.
     A Fast Play Sheet loads without one, so the validator correctly reports
     "1 issue to fix -- Fleet must contain an Admiral" and parks a red panel in
     the middle of the card. The validator being visibly right is a good look;
     an unfixed error in the advertisement is not. Clicked through the modal
     rather than called directly, so this shoots a fleet a person could have
     built by hand. */
  App.openAdmiralModal();
  await wait(900);
  const add = document.querySelector('#modal-admiral [onclick^="App.addGenericAdmiral"]')
    || document.querySelector('[onclick^="App.addGenericAdmiral"]');
  if (!add) throw new Error('no Add button in the Admiral modal');
  add.click();
  await wait(800);
  App.closeModal('modal-admiral');
  await wait(900);

  /* Assert the alert cleared without any further navigation.
     addGenericAdmiral used to call renderAdmiralSlot only, which redraws the
     admiral card and leaves the left rail alone, so "Fleet must contain an
     Admiral" sat on screen over a fleet that had one. This script worked around
     it by leaving the builder and coming back. The workaround is gone because
     the app calls renderOverviewPanel now; this check is what stops it coming
     back silently. */
  const stale = [...document.querySelectorAll('*')]
    .some((e) => !e.children.length && /Fleet must contain an Admiral/.test(e.textContent));
  if (stale) throw new Error('validation panel still reports a missing Admiral');
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bin = CHROME.find((p) => existsSync(p));
if (!bin) { console.error('No Chrome or Edge found. Set CHROME_BIN.'); process.exit(1); }

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(dirname(OUT), { recursive: true });

const proc = spawn(bin, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--headless=new', '--hide-scrollbars',
  `--window-size=${VIEW.width},${VIEW.height}`,
  '--no-first-run', '--no-default-browser-check',
  ...(process.platform === 'win32' ? [] : ['--no-sandbox', '--disable-dev-shm-usage']),
  BASE,
], { stdio: 'ignore' });

let targets = [];
for (let i = 0; i < 40 && !targets.length; i++) {
  await sleep(250);
  try {
    targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json())
      .filter((t) => t.type === 'page');
  } catch {}
}
if (!targets.length) { console.error('Chrome never exposed a page target.'); proc.kill(); process.exit(1); }

const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let msgId = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  const p = pending.get(m.id);
  if (p) { pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
const send = (method, params = {}) => {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', VIEW);
/* The desktop build bounces phone-width viewports to /mobile/, and it checks
   screen.width as well as innerWidth, which a headless window does not
   necessarily report as desktop. Without this the shot is of the mobile app. */
await send('Runtime.evaluate', { expression: `localStorage.setItem('dfc_force_desktop','1')` });
await send('Page.navigate', { url: BASE });
await sleep(2800);

const r = await send('Runtime.evaluate', {
  expression: `(async()=>{ ${SEED} })()`, awaitPromise: true,
}).catch((e) => ({ error: e.message }));
if (r?.error || r?.exceptionDetails) {
  console.error('seed failed:', r.error || r.exceptionDetails?.exception?.description);
  ws.close(); proc.kill(); process.exit(1);
}

/* Finish every running animation before the shot. Headless Chrome does not
   advance the timeline when nothing asks it for frames, so anything that fades
   in captures as its 0% keyframe. */
await send('Runtime.evaluate', {
  expression: `document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} })`,
}).catch(() => {});
await sleep(200);

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

/* Downsample 2240x1176 -> 1200x630. Pillow rather than a node image library
   because this repo has no image dependency and does not need one for a script
   that runs when the app's look changes. */
execFileSync('python', ['-c', `
from PIL import Image
im = Image.open(r"${OUT}")
if im.size != (${CARD.width}, ${CARD.height}):
    im.convert("RGB").resize((${CARD.width}, ${CARD.height}), Image.LANCZOS).save(r"${OUT}", "PNG", optimize=True)
`], { stdio: 'inherit' });

ws.close();
proc.kill();
/* Best effort. proc.kill() returns before Windows has released the profile
   directory's file handles, so a hard rm here throws EPERM and fails a run that
   already wrote the picture. The next run clears it at startup anyway. */
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
console.log(`wrote ${OUT}`);
