import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SavedSentencesList from './SavedSentencesList';

describe('SavedSentencesList URL Format', () => {
    /**
     * @vitest-environment jsdom
     */
    it('generates URLs with underscores and without trailing !!', () => {
        const sentences = [
            { text: 'I fundamental !!', pool: '...' },
            { text: 'Another test sentence:', pool: '...' }
        ];
        const onSelect = vi.fn();
        const onDelete = vi.fn();

        const { getByText } = render(
            <SavedSentencesList
                sentences={sentences}
                onSelect={onSelect}
                onDelete={onDelete}
            />
        );

        const link1 = getByText('I fundamental !!').closest('a');
        expect(link1?.getAttribute('href')).toBe('#I_fundamental');

        const link2 = getByText('Another test sentence:').closest('a');
        expect(link2?.getAttribute('href')).toBe('#Another_test_sentence%3A');
    });
});
