import type { SavedSentence } from './SavedSentencesList';

// Kept free of Firebase imports so the rest of the app can use it without loading the SDK.

export const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);

// No 0/O, 1/I/L, to avoid transcription mistakes.
export const SYNC_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SYNC_CODE_LENGTH = 6;

export const generateSyncCode = (): string => {
  const bytes = new Uint8Array(SYNC_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 % 31 != 0, so this is very slightly biased; irrelevant for this purpose.
  return Array.from(bytes, b => SYNC_CODE_ALPHABET[b % SYNC_CODE_ALPHABET.length]).join('');
};

export const normalizeSyncCode = (input: string): string | null => {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== SYNC_CODE_LENGTH) return null;
  for (const c of code) {
    if (!SYNC_CODE_ALPHABET.includes(c)) return null;
  }
  return code;
};

export const formatSyncCode = (code: string) =>
  `${code.slice(0, SYNC_CODE_LENGTH / 2)}-${code.slice(SYNC_CODE_LENGTH / 2)}`;

// Realtime Database keys may not contain . $ # [ ] /
export const sentenceKey = (text: string) =>
  encodeURIComponent(text).replace(/\./g, '%2E');

/**
 * Dates sentences saved before sync existed. Their real save time is unknown, so they get 0, which
 * keeps them at the bottom of the list where they already were. Returns null if there's nothing to
 * do, so the caller can skip rewriting the cookie.
 */
export const stampSavedAt = (sentences: SavedSentence[]): SavedSentence[] | null => {
  if (!sentences.some(s => s.savedAt === undefined)) return null;
  return sentences.map(s => s.savedAt === undefined ? { ...s, savedAt: 0 } : s);
};

export const sortSentences =(sentences: SavedSentence[]): SavedSentence[] =>
  // Array.prototype.sort is stable, so entries without `savedAt` keep their order.
  [...sentences].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

/**
 * Combines the local list with the remote one when a sync session starts.
 * Remote is authoritative (so deletions made elsewhere stick), except that local entries are
 * uploaded when joining a code for the first time, or when saved since the last sync.
 *
 * An entry with no `savedAt` counts as newer than any sync: App stamps old sentences on load, so
 * this only comes up if that hasn't happened, and keeping a sentence that was deleted elsewhere is
 * much better than dropping one that was never uploaded.
 */
export const mergeSentences = (
  local: SavedSentence[],
  remote: SavedSentence[],
  lastSyncedAt: number,
  isFirstJoin: boolean,
): { merged: SavedSentence[]; toUpload: SavedSentence[] } => {
  const remoteTexts = new Set(remote.map(s => s.text));
  const toUpload = local
    .filter(s => !remoteTexts.has(s.text))
    .filter(s => isFirstJoin || (s.savedAt ?? Infinity) > lastSyncedAt)
    .map(s => ({ ...s, savedAt: s.savedAt ?? 0 }));
  return { merged: sortSentences([...remote, ...toUpload]), toUpload };
};
