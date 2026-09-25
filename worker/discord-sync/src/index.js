/* Discord sign-in for Fleet Sync.
 *
 * Discord's login needs a server because it hands out an access code that can
 * only be swapped for the user's identity with the app's client secret, and a
 * secret cannot live in a static site. This Worker is that server, and it does
 * the least it can:
 *
 *   /login     sends the browser to Discord's consent page
 *   /callback  Discord sends the browser back here with a code; the Worker swaps
 *              it for the user's Discord id, then sends the browser back to the
 *              builder with a sync key in the URL fragment
 *
 * The sync key is HMAC-SHA256(SYNC_SECRET, "discord:" + id), written as letters
 * so it passes the app's existing Sync Token checks. It names the user's
 * Firestore document under /sync, exactly like a six-word token does, so the
 * app's whole sync engine works on it unchanged. Only this Worker can compute a
 * key, and only for someone who just proved to Discord who they are.
 *
 * SYNC_SECRET must never change: every Discord user's key is derived from it,
 * so a new secret points everyone at an empty document. It is backed up in
 * worker/discord-sync/.secrets (gitignored) on the machine that deployed it.
 *
 * Nothing is stored here. No database, no logs of who signed in.
 */

const DISCORD = 'https://discord.com';

// Where the Worker may send people back to. Anything else is refused, so the
// Worker cannot be used to bounce someone's sync key to a stranger's page.
function allowedReturn(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && u.host === 'type37.github.io' &&
        u.pathname.startsWith('/dropfleet-builder/')) return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return false;
  } catch (e) { return false; }
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function packState(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}
function unpackState(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}

// 32 bytes -> 64 letters a..p, in four hyphenated groups. Letters only, because
// the app normalises tokens to [a-z-]; four groups, because it expects at least
// four parts. 256 bits, so there is nothing to guess.
async function syncKey(secret, discordId) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode('discord:' + discordId)));
  let letters = '';
  for (const b of mac) letters += String.fromCharCode(97 + (b >> 4), 97 + (b & 15));
  return 'discord-' + letters.match(/.{16}/g).join('-');
}

function back(returnUrl, params) {
  const u = new URL(returnUrl);
  u.hash = new URLSearchParams(params).toString();
  return Response.redirect(u.toString(), 302);
}

function plain(status, text) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const callback = url.origin + '/callback';

    if (url.pathname === '/login') {
      const ret = url.searchParams.get('return') || '';
      const nonce = url.searchParams.get('state') || '';
      if (!allowedReturn(ret) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return plain(400, 'Bad request');
      const auth = new URL(DISCORD + '/oauth2/authorize');
      auth.search = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        response_type: 'code',
        redirect_uri: callback,
        scope: 'identify',
        prompt: 'none',
        state: packState({ n: nonce, r: ret })
      }).toString();
      return Response.redirect(auth.toString(), 302);
    }

    if (url.pathname === '/callback') {
      let st;
      try { st = unpackState(url.searchParams.get('state')); } catch (e) { return plain(400, 'Bad request'); }
      if (!st || !allowedReturn(st.r)) return plain(400, 'Bad request');

      // Cancelled on Discord's page, or Discord refused.
      const code = url.searchParams.get('code');
      if (!code) return back(st.r, { dsync_error: url.searchParams.get('error') || 'cancelled', ds: st.n });

      const tokRes = await fetch(DISCORD + '/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: callback
        })
      });
      if (!tokRes.ok) return back(st.r, { dsync_error: 'exchange', ds: st.n });
      const tok = await tokRes.json();

      const meRes = await fetch(DISCORD + '/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tok.access_token }
      });
      if (!meRes.ok) return back(st.r, { dsync_error: 'profile', ds: st.n });
      const me = await meRes.json();

      // Done with Discord: revoke so the access token never outlives this request.
      fetch(DISCORD + '/api/oauth2/token/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          token: tok.access_token
        })
      }).catch(() => {});

      const avatar = me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64`
        : '';
      return back(st.r, {
        dsync: await syncKey(env.SYNC_SECRET, me.id),
        ds: st.n,
        dn: me.global_name || me.username || 'Discord',
        da: avatar
      });
    }

    return plain(404, 'Not found');
  }
};
