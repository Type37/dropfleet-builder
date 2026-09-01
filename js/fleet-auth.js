/* Fleet Auth — optional "Continue with Google" sign-in.
 *
 * Loaded by BOTH apps before fleet-sync.js, which asks this file who is signed
 * in so it knows which Firestore document to sync.
 *
 * Design, and why it looks like this:
 *
 * - No Firebase SDK. The Auth + Firestore SDKs are ~400 KB from a CDN, which
 *   fights this app's offline-first service worker and its no-build-step rule.
 *   Everything here is `fetch` against two documented REST endpoints:
 *     identitytoolkit.googleapis.com  sign in, look up the account
 *     securetoken.googleapis.com      refresh the ID token
 *
 * - The one script we do load is Google's own Identity Services (GIS), and it
 *   loads LAZILY, on the first click of the sign-in button. The app must keep
 *   working with no network, and signing in is the one action that cannot.
 *
 * - The button is Google's rendered button rather than one of ours. Google's
 *   branding terms ask for it, and it is the path that reliably returns an
 *   ID token; a hand-rolled button would have to go through the access-token
 *   flow instead, which is a second way to get the same result with more
 *   moving parts.
 *
 * - Signing in is NOT required. The six-word Sync Token still works exactly as
 *   it did, for anyone who wants sync without an account. An account just
 *   removes the phrase you have to carry between devices.
 *
 * - The refresh token lives in localStorage. That is what the Firebase SDK does
 *   too (in IndexedDB), and the threat model is the same: anything that can run
 *   script on this origin has already won.
 *
 * SETUP (all in the Firebase / Google Cloud consoles, see docs/AUTH-SETUP.md):
 *   1. Authentication > Sign-in method > enable Google.
 *   2. Authentication > Settings > Authorized domains > add type37.github.io.
 *   3. Copy the Google provider's "Web SDK configuration" Web client ID into
 *      GOOGLE_CLIENT_ID below.
 *   4. Google Cloud > Credentials > that OAuth client > Authorized JavaScript
 *      origins > add https://type37.github.io (and http://localhost:8099 to
 *      test locally).
 * Until step 3 is done, configured() is false and the app shows no sign-in
 * button at all, so shipping this file early changes nothing for anyone.
 */
(function () {
  'use strict';

  const PROJECT = 'dropfleet-builder';
  const API_KEY = 'AIzaSyCuVs19-E131IHSZ_smWcLLl52djAZuJ60';

  // Paste the Web client ID from Firebase > Authentication > Sign-in method >
  // Google > Web SDK configuration. Ends in .apps.googleusercontent.com.
  const GOOGLE_CLIENT_ID = '';

  const IDP = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' + API_KEY;
  const REFRESH = 'https://securetoken.googleapis.com/v1/token?key=' + API_KEY;
  const GIS_SRC = 'https://accounts.google.com/gsi/client';

  const AUTH_KEY = 'dfc_auth';

  /* ── Stored session ──────────────────────────────────────── */
  let session = null;
  try {
    const raw = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    if (raw && raw.uid && raw.refreshToken) session = raw;
  } catch (e) { session = null; }

  function persist() {
    try {
      if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) { /* private mode; the session just will not survive a reload */ }
  }

  function configured() { return !!GOOGLE_CLIENT_ID; }
  function supported() {
    try { return !!(window.fetch && localStorage && configured()); }
    catch (e) { return false; }
  }

  // The public shape of a signed-in user. Deliberately small: the app never
  // needs anything but a name to greet them with and a uid to key the document.
  function user() {
    if (!session) return null;
    return {
      uid: session.uid,
      email: session.email || '',
      name: session.name || session.email || 'Signed in',
      picture: session.picture || ''
    };
  }

  /* ── Token freshness ─────────────────────────────────────────
   * Firebase ID tokens last an hour. Refresh a minute early rather than on
   * expiry, so a sync that starts just before the boundary cannot 401 mid-flight.
   * Concurrent callers share one refresh; a burst of syncs must not fire a burst
   * of refreshes. */
  const SKEW_MS = 60000;
  let refreshing = null;

  async function idToken() {
    if (!session) return null;
    if (session.idToken && Date.now() < (session.expiresAt || 0) - SKEW_MS) return session.idToken;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const res = await fetch(REFRESH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(session.refreshToken)
        });
        if (!res.ok) {
          // A refresh token is only rejected when the account is gone or the
          // session was revoked. Anything else (offline, 5xx) throws instead,
          // and the caller retries later rather than losing the session.
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            signOut();
            return null;
          }
          throw new Error('Could not refresh the sign-in (HTTP ' + res.status + ').');
        }
        const j = await res.json();
        session.idToken = j.id_token;
        session.refreshToken = j.refresh_token || session.refreshToken;
        session.expiresAt = Date.now() + (parseInt(j.expires_in, 10) || 3600) * 1000;
        persist();
        return session.idToken;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  /* ── Google Identity Services ────────────────────────────── */
  let gisLoading = null;
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Could not reach Google to sign in. Check your connection.')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  /* Exchange the Google ID token from GIS for a Firebase session. */
  async function exchange(googleIdToken) {
    const res = await fetch(IDP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: 'id_token=' + encodeURIComponent(googleIdToken) + '&providerId=google.com',
        requestUri: location.origin,
        returnIdpCredential: true,
        returnSecureToken: true
      })
    });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j && j.error && j.error.message) || ''; } catch (e) {}
      // The two failures a misconfigured project actually produces, named so the
      // person setting it up knows which console page to open.
      if (/INVALID_IDP_RESPONSE|MISSING_OR_INVALID_NONCE/.test(detail)) {
        throw new Error('Google turned down the sign-in. The site may not be listed on the OAuth client yet.');
      }
      if (/OPERATION_NOT_ALLOWED/.test(detail)) {
        throw new Error('Google sign-in is not switched on for this project yet.');
      }
      throw new Error(detail || ('Sign-in failed (HTTP ' + res.status + ').'));
    }
    const j = await res.json();
    session = {
      uid: j.localId,
      email: j.email || '',
      name: j.displayName || j.fullName || '',
      picture: j.photoUrl || '',
      idToken: j.idToken,
      refreshToken: j.refreshToken,
      expiresAt: Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000
    };
    persist();
    if (typeof api.onChange === 'function') api.onChange(user());
    return user();
  }

  /* Render Google's own button into `el`. Resolves when the person actually
   * signs in, so callers can await the whole thing and then re-render. */
  function mountGoogleButton(el, opts) {
    if (!configured()) return Promise.reject(new Error('Google sign-in is not configured in this build.'));
    if (!el) return Promise.reject(new Error('Nowhere to put the sign-in button.'));
    return loadGis().then(() => new Promise((resolve, reject) => {
      let settled = false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (resp) => {
          if (settled) return;
          settled = true;
          if (!resp || !resp.credential) { reject(new Error('Google did not return a sign-in.')); return; }
          exchange(resp.credential).then(resolve, reject);
        }
      });
      el.innerHTML = '';
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: (opts && opts.theme) || 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: (opts && opts.width) || 260
      });
    }));
  }

  function signOut() {
    session = null;
    persist();
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
    if (typeof api.onChange === 'function') api.onChange(null);
  }

  const api = {
    configured, supported, user, idToken, mountGoogleButton, signOut,
    onChange: null      // apps assign a re-render callback
  };
  window.FleetAuth = api;
})();
