import { describe, it, expect } from 'vitest';
import {
    SYNC_CODE_ALPHABET,
    SYNC_CODE_LENGTH,
    formatSyncCode,
    generateSyncCode,
    mergeSentences,
    normalizeSyncCode,
    sentenceKey,
    sortSentences,
    stampSavedAt,
} from './syncCode';

describe('stampSavedAt', () => {
    it('stamps only the entries that lack a timestamp, without reordering them', () => {
        expect(stampSavedAt([{ text: 'a', pool: '' }, { text: 'b', pool: '', savedAt: 5 }]))
            .toEqual([{ text: 'a', pool: '', savedAt: 0 }, { text: 'b', pool: '', savedAt: 5 }]);
    });

    it('returns null when every entry already has one', () => {
        expect(stampSavedAt([{ text: 'a', pool: '', savedAt: 5 }])).toBeNull();
        expect(stampSavedAt([])).toBeNull();
    });
});

describe('sync codes', () => {
    it('generates codes of the right length from the alphabet', () => {
        for (let i = 0; i < 50; i++) {
            const code = generateSyncCode();
            expect(code).toHaveLength(SYNC_CODE_LENGTH);
            for (const c of code) expect(SYNC_CODE_ALPHABET).toContain(c);
            expect(normalizeSyncCode(code)).toBe(code);
        }
    });

    it('normalizes user input', () => {
        expect(normalizeSyncCode('k7q-m3x')).toBe('K7QM3X');
        expect(normalizeSyncCode('  K7Q M3X ')).toBe('K7QM3X');
        expect(normalizeSyncCode(formatSyncCode('K7QM3X'))).toBe('K7QM3X');
    });

    it('rejects malformed codes', () => {
        expect(normalizeSyncCode('K7QM3')).toBeNull();    // too short
        expect(normalizeSyncCode('K7QM3X9')).toBeNull();  // too long
        expect(normalizeSyncCode('K7QM30')).toBeNull();   // 0 is not in the alphabet
        expect(normalizeSyncCode('K7QM3/')).toBeNull();
    });

    it('formats with a dash in the middle', () => {
        expect(formatSyncCode('K7QM3X')).toBe('K7Q-M3X');
    });
});

describe('sentenceKey', () => {
    it('never produces characters forbidden in Realtime Database keys', () => {
        const key = sentenceKey('I think. $that# [is] a/b, c: fundamental!!');
        expect(key).not.toMatch(/[.$#[\]/]/);
        expect(decodeURIComponent(key)).toBe('I think. $that# [is] a/b, c: fundamental!!');
    });
});

describe('mergeSentences', () => {
    const s = (text: string, savedAt?: number) => ({ text, pool: '', savedAt });

    it('uploads all missing local sentences on first join', () => {
        const { merged, toUpload } = mergeSentences([s('a'), s('b', 5)], [s('c', 10)], 0, true);
        expect(toUpload.map(x => x.text)).toEqual(['a', 'b']);
        expect(merged.map(x => x.text)).toEqual(['c', 'b', 'a']);
    });

    it('does not duplicate sentences already present remotely', () => {
        const { merged, toUpload } = mergeSentences([s('a', 3)], [s('a', 1)], 0, true);
        expect(toUpload).toEqual([]);
        expect(merged).toEqual([s('a', 1)]);
    });

    it('does not resurrect sentences deleted on another device', () => {
        const { merged, toUpload } = mergeSentences([s('deleted', 5), s('kept', 6)], [s('kept', 6)], 100, false);
        expect(toUpload).toEqual([]);
        expect(merged.map(x => x.text)).toEqual(['kept']);
    });

    it('uploads sentences saved since the last sync', () => {
        const { merged, toUpload } = mergeSentences([s('offline', 200), s('old', 50)], [], 100, false);
        expect(toUpload.map(x => x.text)).toEqual(['offline']);
        expect(merged.map(x => x.text)).toEqual(['offline']);
    });

    it('keeps undated local sentences that the server has never seen', () => {
        // Regression: a device created a code while the rules still denied writes, so its
        // sentences never uploaded and `mosaic_sync_last` was never set. On the next load it must
        // upload them again, not treat the empty server as the truth and drop them.
        const local = [{ text: 'I am old', pool: '' }, { text: 'I am older', pool: '' }];
        const { merged, toUpload } = mergeSentences(local, [], 0, false);
        expect(toUpload.map(x => x.text)).toEqual(['I am old', 'I am older']);
        expect(merged.map(x => x.text)).toEqual(['I am old', 'I am older']);
        expect(toUpload.every(x => typeof x.savedAt === 'number')).toBe(true);
    });

    it('sorts newest first, keeping order for undated entries', () => {
        expect(sortSentences([s('x'), s('new', 9), s('y'), s('mid', 4)]).map(x => x.text))
            .toEqual(['new', 'mid', 'x', 'y']);
    });
});
