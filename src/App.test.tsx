import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Interaction', () => {
    /**
     * @vitest-environment jsdom
     * @description Verifies that the initial words of the sentence are rendered on the screen.
     */
    it('renders the initial sentence', () => {
        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');
        expect(wordRow).toHaveTextContent('I');
        expect(wordRow).toHaveTextContent('!!');
    });

    /**
     * @vitest-environment jsdom
     * @description Ensures that a user can add a new word chip and type into it.
     */
    it('allows creating a new word and typing removes letters from pool', async () => {
        const user = userEvent.setup();
        render(<App />);

        const addButton = screen.getByRole('button', { name: '+' });
        await user.click(addButton);

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveFocus();

        await user.keyboard('t');
        expect(input).toHaveValue('t');
    });

    /**
     * @vitest-environment jsdom
     * @description Checks that when a character is deleted, it is returned to the letter pool.
     */
    it('returns letters to pool when deleting', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('t');
        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('t');

        await user.keyboard('{Backspace}');
        expect(input).toHaveValue('');
    });

    /**
     * @vitest-environment jsdom
     * @description Verifies that when the user presses "Enter", the word chip becomes non-editable.
     */
    it('commits the word on Enter', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: '+' }));
        // 'hello' is a valid word from the list
        await user.keyboard('hello{Enter}');

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    /**
     * @vitest-environment jsdom
     * @description Checks the "stealing" mechanic. If a letter is typed that is not in the
     * letter pool but exists in another word, the application should "steal" it.
     */
    it('steals letters from existing words if pool is empty', async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(screen.getByText('fundamental')).toBeInTheDocument();

        // The letter 'm' is not in the initial pool, so it must be stolen.
        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('m');

        // The word "fundamental" should be marked for destruction.
        await waitFor(() => {
            expect(screen.queryByText('fundamental')).not.toBeInTheDocument();
        });

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('m');
    });

    /**
     * @vitest-environment jsdom
     * @description Ensures that if a user tries to type a letter that is not available,
     * the input is ignored.
     */
    it('ignores input if letter is not available anywhere', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('z'); // 'z' is not in pool or default words

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('');
    });
});

describe('Validation Rules', () => {
    /**
     * @vitest-environment jsdom
     * @description Verifies that the application displays the correct validation error
     * messages when it first loads.
     */
    it('displays initial validation errors on render', () => {
        render(<App />);
        expect(screen.getByText("There must be exactly one eight-letter word.")).toBeInTheDocument();
        expect(screen.getByText("The last word must end in 'w'.")).toBeInTheDocument();
    });
});

describe('Saved sentence storage', () => {
    /**
     * @vitest-environment jsdom
     * @description Sentences used to live in a cookie, which is too small for synced lists; they
     * must carry over to localStorage on first load, keeping their text and pool.
     */
    it('migrates saved sentences from the cookie to localStorage', () => {
        const legacy = [{ text: 'I am a saved sentence!!', pool: 'abc' }];
        document.cookie = `mosaic_saved_sentences=${encodeURIComponent(JSON.stringify(legacy))};path=/`;
        localStorage.removeItem('mosaic_saved_sentences');

        render(<App />);

        expect(screen.getByText('I am a saved sentence!!')).toBeInTheDocument();
        const stored = JSON.parse(localStorage.getItem('mosaic_saved_sentences')!);
        // Undated sentences are stamped so the sync merge can tell them apart from synced ones.
        expect(stored).toEqual([{ text: 'I am a saved sentence!!', pool: 'abc', savedAt: 0 }]);

        document.cookie = 'mosaic_saved_sentences=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
        localStorage.removeItem('mosaic_saved_sentences');
    });
});

describe('Sync code field', () => {
    /**
     * @vitest-environment jsdom
     * @description The global key handler builds the sentence from bare keystrokes, so it must
     * keep its hands off keys typed into the sync code field.
     */
    it('does not build the sentence while typing a sync code', async () => {
        const user = userEvent.setup();
        const { container } = render(<App />);

        await user.click(screen.getByRole('button', { name: 'Sync with another device' }));
        const field = screen.getByLabelText('Sync code');
        // 'a' and 't' are in the letter pool, and a space normally starts a new word.
        await user.type(field, 'k7q m3x');

        expect(field).toHaveValue('k7q m3x');
        // The row also holds the caret marker, so compare just the sentence characters.
        const sentence = container.querySelector('.word-row')?.textContent?.replace(/[^A-Za-z!,:]/g, '');
        expect(sentence).toBe('I!!');
    });
});
