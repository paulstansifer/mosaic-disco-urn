# Developing Mosaic Disco Urn

## Running locally

```
nvm install 20  # if necessary
nvm use 20      # if necessary
npm install
npm run dev     # development server
npm test        # vitest
npm run lint
npm run build   # type-check and production build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Syncing saved sentences between devices

Saved sentences are stored locally in `localStorage` under `mosaic_saved_sentences`. They used to
live in a cookie of the same name, which held only about 4KB (roughly 20 sentences, fewer once
syncing merges devices' lists) and failed silently past that; the cookie is still read once, to
carry existing sentences over.

Optionally, a device can sync them with other devices by sharing a 6-character code, shown as
`K7Q-M3X` (the "Sync with another device" button under "Saved Sentences").

- Anyone with the code can read and edit that code's sentences; there are no accounts.
- "New code" claims the code by writing `/sync/{CODE}/createdAt`, which the rules only allow when
  the code is unused. Joining first checks that `/sync/{CODE}` exists, so a made-up code is refused
  rather than silently becoming a new sync space. The claim is what makes a code that has no
  sentences saved yet joinable.
- Data lives in the Firebase Realtime Database at
  `https://mosaic-disco-urn-4b5ba-default-rtdb.firebaseio.com/`, under
  `/sync/{CODE}/sentences/{encoded sentence text}`, as `{ text, pool, savedAt }`.
- Clients sign in with Firebase anonymous auth.
- The current code is kept in `localStorage` (`mosaic_sync_code`), along with the last time the
  server confirmed this device's changes (`mosaic_sync_last`). On startup, the remote list wins,
  except for local sentences saved after that time, which are uploaded.
- `mosaic_sync_last` is only written once the server has accepted everything this device knows
  about, and a session that had a write rejected never writes it. While it is absent, a session
  uploads every local sentence the server doesn't have, rather than letting the remote list win.
  This is what keeps a device from losing its sentences when its first upload fails.
- Sentences saved before sync existed have no `savedAt`. They are dated 0 on load, so they keep
  their place at the bottom of the list, and `mergeSentences` treats a still-undated sentence as
  newer than any sync, since resurrecting a deleted sentence beats losing one.
- Saves and deletes made before `src/sync.ts` has finished loading are queued and flushed when it
  arrives, so a delete isn't quietly undone by the first snapshot.
- `src/syncCode.ts` has the pure logic (codes, keys, merging). `src/sync.ts` talks to Firebase and
  is loaded with a dynamic `import()`, so the SDK is only downloaded once a device starts syncing.

### Configuration

The Firebase web config comes from build-time environment variables. Locally, put these in
`.env.local` (which is git-ignored); for deployment, they are GitHub Actions repository secrets with
the same names:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

If `VITE_FIREBASE_API_KEY` or `VITE_FIREBASE_PROJECT_ID` is missing, the sync UI is hidden.
The database URL is hardcoded in `src/firebase.ts`.

### One-time Firebase console setup

1. Authentication → Sign-in method: enable **Anonymous**.
2. Authentication → Settings → Authorized domains: include `paulstansifer.github.io` and `localhost`.
3. Realtime Database → Rules: paste the contents of `database.rules.json` and publish (or run
   `firebase deploy --only database` with the Firebase CLI). The rules deny listing `/sync`, only
   allow reading a well-formed code, and only allow writing one validated sentence at a time.

If the sync status shows "Permission denied" or "Anonymous sign-in is not enabled", one of these
steps is missing.
