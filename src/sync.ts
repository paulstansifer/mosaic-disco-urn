import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, onValue, ref, remove, set } from 'firebase/database';
import { getFirebaseApp } from './firebase';
import { mergeSentences, sentenceKey, sortSentences } from './syncCode';
import type { SavedSentence } from './SavedSentencesList';

// This module is loaded with a dynamic `import()` so the Firebase SDK is only downloaded when
// sync is actually in use.

export type SyncStatus =
  | { state: 'connecting' }
  | { state: 'synced' }
  | { state: 'offline' }
  | { state: 'error'; message: string };

export interface SyncHandle {
  save: (sentence: SavedSentence) => void;
  remove: (text: string) => void;
  stop: () => void;
}

interface SyncOptions {
  getLocal: () => SavedSentence[];
  lastSyncedAt: number;
  isFirstJoin: boolean;
  onRemote: (sentences: SavedSentence[]) => void;
  onStatus: (status: SyncStatus) => void;
  // Called when the server has confirmed everything this device knows about.
  onSyncedAt: (time: number) => void;
}

const describeError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? '';
  const message = e instanceof Error ? e.message : String(e);
  if (/permission.denied|PERMISSION_DENIED/i.test(code + message)) {
    return 'Permission denied (are the database rules deployed?)';
  }
  if (/admin-restricted-operation|operation-not-allowed/.test(code)) {
    return 'Anonymous sign-in is not enabled for this Firebase project';
  }
  return message;
};

const connect = async () => {
  const app = getFirebaseApp();
  await signInAnonymously(getAuth(app));
  return getDatabase(app);
};

/**
 * Marks a newly generated code as taken, so that a device joining it finds something even before
 * any sentence is saved. The rules only allow this when the code is unused, so a code that somehow
 * collides with an existing one is rejected rather than quietly joined.
 */
export const claimCode = async (code: string): Promise<void> => {
  const db = await connect();
  await set(ref(db, `sync/${code}/createdAt`), Date.now());
};

/** Whether anyone has ever used this code, so made-up codes can be refused. */
export const codeExists = async (code: string): Promise<boolean> => {
  const db = await connect();
  return (await get(ref(db, `sync/${code}`))).exists();
};

export const startSync = (code: string, options: SyncOptions): SyncHandle => {
  const app = getFirebaseApp();
  const db = getDatabase(app);
  const sentencesRef = ref(db, `sync/${code}/sentences`);

  let stopped = false;
  let receivedFirstSnapshot = false;
  let connected = false;
  let pendingWrites = 0;
  // Sticky: once a write has been rejected, this session must not record itself as synced, or the
  // next load would treat the server as authoritative and drop what never made it up there.
  let writeFailed = false;
  const unsubscribes: Array<() => void> = [];

  const reportSyncedIfIdle = () => {
    if (!stopped && connected && receivedFirstSnapshot && pendingWrites === 0 && !writeFailed) {
      options.onStatus({ state: 'synced' });
      options.onSyncedAt(Date.now());
    }
  };

  // Takes a thunk, not a promise: firing the write first would let its local snapshot event run
  // the `onValue` handler with `pendingWrites` still at 0, recording a sync the server hasn't
  // acknowledged yet.
  const track = (issueWrite: () => Promise<void>) => {
    pendingWrites++;
    issueWrite()
      .then(() => {
        pendingWrites--;
        reportSyncedIfIdle();
      })
      .catch(e => {
        pendingWrites--;
        writeFailed = true;
        console.error('Sync write failed', e);
        if (!stopped) options.onStatus({ state: 'error', message: describeError(e) });
      });
  };

  const writeSentence = (sentence: SavedSentence) =>
    track(() => set(ref(db, `sync/${code}/sentences/${sentenceKey(sentence.text)}`), {
      text: sentence.text,
      pool: sentence.pool,
      savedAt: sentence.savedAt ?? 0,
    }));

  options.onStatus({ state: 'connecting' });

  signInAnonymously(getAuth(app))
    .then(() => {
      if (stopped) return;

      unsubscribes.push(onValue(ref(db, '.info/connected'), snap => {
        connected = snap.val() === true;
        if (!connected && receivedFirstSnapshot) options.onStatus({ state: 'offline' });
        reportSyncedIfIdle();
      }));

      unsubscribes.push(onValue(sentencesRef, snap => {
        if (stopped) return;
        const remote: SavedSentence[] = Object.values(snap.val() ?? {});

        if (!receivedFirstSnapshot) {
          receivedFirstSnapshot = true;
          const { merged, toUpload } = mergeSentences(
            options.getLocal(), remote, options.lastSyncedAt, options.isFirstJoin);
          toUpload.forEach(writeSentence);
          options.onRemote(merged);
        } else {
          options.onRemote(sortSentences(remote));
        }
        reportSyncedIfIdle();
      }, e => {
        console.error('Sync subscription failed', e);
        if (!stopped) options.onStatus({ state: 'error', message: describeError(e) });
      }));
    })
    .catch(e => {
      console.error('Anonymous sign-in failed', e);
      if (!stopped) options.onStatus({ state: 'error', message: describeError(e) });
    });

  return {
    save: writeSentence,
    remove: text => track(() => remove(ref(db, `sync/${code}/sentences/${sentenceKey(text)}`))),
    stop: () => {
      stopped = true;
      unsubscribes.forEach(u => u());
    },
  };
};
