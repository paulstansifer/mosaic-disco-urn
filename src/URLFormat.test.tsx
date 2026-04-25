import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import App from './App';

describe('URL Format and Parsing', () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        window.location.hash = '';
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: mockWriteText
            }
        });
        mockWriteText.mockClear();
        // and stub location
        vi.stubGlobal('location', {
            ...window.location,
            origin: 'http://localhost',
            pathname: '/'
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /**
     * @vitest-environment jsdom
     */
    it('loads a URL with underscores as spaces', () => {
        window.location.hash = '#I_fundamental';
        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');

        // Should contain 'I' and 'fundamental'
        expect(wordRow).toHaveTextContent('I');
        expect(wordRow).toHaveTextContent('fundamental');

        // Verify they are separate chips
        const chips = container.querySelectorAll('.word-chip');
        expect(Array.from(chips).some(c => c.textContent === 'I')).toBe(true);
        expect(Array.from(chips).some(c => c.textContent === 'fundamental')).toBe(true);
    });

    /**
     * @vitest-environment jsdom
     */
    it('loads a URL with spaces still works', () => {
        window.location.hash = '#I fundamental';
        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');

        expect(wordRow).toHaveTextContent('I');
        expect(wordRow).toHaveTextContent('fundamental');
    });

    /**
     * @vitest-environment jsdom
     */
    it('adds !! back when loading a URL that omitted them and they are the only thing left in pool', () => {
        // All characters EXCEPT "!!"
        const sentence = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,";
        window.location.hash = '#' + sentence;

        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');

        // The !! should be automatically added back
        expect(wordRow).toHaveTextContent('!!');

        const chips = container.querySelectorAll('.word-chip');
        expect(Array.from(chips).some(c => c.textContent === '!!')).toBe(true);
    });

});
