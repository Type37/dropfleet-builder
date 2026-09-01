# Sign-in setup (Google)

The code is shipped and inert. `js/fleet-auth.js` has an empty
`GOOGLE_CLIENT_ID`, and while it is empty `FleetAuth.configured()` is false, so
neither app shows a sign-in button and the Sync Token flow is exactly what it
has always been. Filling in that one constant is what switches the feature on.

Everything below happens in consoles I cannot reach. Five steps, about ten
minutes.

## 1. Turn on the Google provider

Firebase console → project **dropfleet-builder** → **Authentication** →
**Sign-in method** → **Add new provider** → **Google** → enable → Save.

Firebase will ask for a project support email. Any address you own is fine; it
is shown on the Google consent screen.

## 2. Let the live site use it

Still in **Authentication** → **Settings** → **Authorized domains** → **Add
domain** → `type37.github.io`.

The project currently authorizes only `localhost`,
`dropfleet-builder.firebaseapp.com` and `dropfleet-builder.web.app`, so without
this step sign-in works nowhere real. You can check the list any time with:

```bash
curl -s "https://identitytoolkit.googleapis.com/v1/projects?key=AIzaSyCuVs19-E131IHSZ_smWcLLl52djAZuJ60"
```

## 3. Copy the Web client ID

**Authentication** → **Sign-in method** → **Google** → expand **Web SDK
configuration**. Copy the **Web client ID**; it ends in
`.apps.googleusercontent.com`.

Paste it into `js/fleet-auth.js`:

```js
const GOOGLE_CLIENT_ID = '....apps.googleusercontent.com';
```

It is not a secret. Like the Firebase API key already in the repo, it identifies
the project and authorises nothing on its own.

## 4. Let the browser button use it

Google Cloud console → same project → **APIs & Services** → **Credentials** →
click the OAuth 2.0 Client ID from step 3 → **Authorized JavaScript origins** →
add:

- `https://type37.github.io`
- `http://localhost:8099` (only if you want to test locally)

This is separate from step 2 and both are required. Step 2 is Firebase deciding
which sites may hold a session; this is Google deciding which sites may render
the sign-in button. Miss it and the button appears but the popup fails with
"origin is not allowed".

## 5. Publish the Firestore rules

Firebase console → **Firestore Database** → **Rules** → paste the contents of
`firestore.rules` from the repo root → **Publish**.

The new part is the `/users/{uid}` block. Without it, a signed-in user's sync
gets a 403 on the first write, and the app will say sync was refused by the
server.

## Checking it worked

Open the app → Settings → Sync Fleets Online. You should see **Continue with
Google** above an **or** rule, with the Sync Token flow underneath.

Sign in on a desktop, then sign in with the same Google account on a phone: the
fleets should arrive on their own, no phrase typed anywhere.

If you had a Sync Token before signing in, the panel offers **Bring your Sync
Token fleets in**. That folds the token's fleets into the account once and stops
this device syncing on the token. The token's own cloud document is left alone,
so any other device still holding it keeps working.

## What this changed in the data

Nothing moved. Token sync still lives at `/sync/{six-word-phrase}`; accounts get
a new `/users/{uid}` document with the identical
`{payload, updatedAt, version}` shape and the same merge engine. A device is in
exactly one mode at a time (`FleetSync.mode()` returns `'account'`, `'token'` or
`null`), because writing both documents would make two copies race over one
list.

## Discord

Not done, and it needs a piece we do not have. Discord publishes no OIDC
discovery document and issues no `id_token`, so Firebase cannot consume it the
way it consumes Google. It needs a small server endpoint holding the Discord
client secret, which exchanges the OAuth code and mints a Firebase custom token.
A free Cloudflare Worker is the cheapest home for that. Roughly sixty lines,
plus a Discord application and a Firebase service-account key.
