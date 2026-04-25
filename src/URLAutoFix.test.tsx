import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';

describe('App URL and Load Logic', () => {
    beforeEach(() => {
        // Reset hash before each test
        window.location.hash = '';
    });

    /**
     * @vitest-environment jsdom
     */
    it('automatically adds !! to the end if missing from URL hash and it is the only thing left in pool', () => {
        // INITIAL_POOL_SOURCE minus "!!"
        const sentence = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,";
        window.location.hash = '#' + encodeURIComponent(sentence);

        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');

        // It should contain the original characters AND !! at the end
        expect(wordRow).toHaveTextContent('!!');

        const chips = container.querySelectorAll('.word-chip');
        const lastChip = chips[chips.length - 1];
        expect(lastChip).toHaveTextContent('!!');
    });

    /**
     * @vitest-environment jsdom
     */
    it('does not add !! if there are other characters remaining in the pool', () => {
        // Just "I" leaves almost everything in the pool.
        window.location.hash = '#I';
        const { container } = render(<App />);
        const chips = container.querySelectorAll('.word-chip');
        const bangChips = Array.from(chips).filter(c => c.textContent === '!!');

        // It should NOT have '!!' because many other characters remain.
        expect(bangChips.length).toBe(0);
    });

    /**
     * @vitest-environment jsdom
     */
    it('does not add !! if they are already present', () => {
        const sentence = "ttttttttttttooooooooooeeeeeeeeaaaaaaallllllnnnnnnuuuuuuiiiiisssssdddddhhhhhyyyyyIIIrrrfffbbwwkcmvg:,!!";
        window.location.hash = '#' + encodeURIComponent(sentence);

        const { container } = render(<App />);
        const chips = container.querySelectorAll('.word-chip');
        const bangChips = Array.from(chips).filter(c => c.textContent === '!!');

        // Should only have one '!!'
        expect(bangChips.length).toBe(1);
    });
});
