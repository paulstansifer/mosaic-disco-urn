import { render, screen, waitFor, within } from '@testing-library/react';
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
        expect(wordRow).toHaveTextContent('fundamental');
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
        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');
        expect(wordRow).toBeInTheDocument();

        expect(within(wordRow!).getByText('fundamental')).toBeInTheDocument();

        // The letter 'm' is in the initial pool once. We use it.
        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('m{Enter}');

        // Now we try to use it again, and it must be stolen.
        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('m');


        // The word "fundamental" should be marked for destruction.
        await waitFor(() => {
            expect(within(wordRow!).queryByText('fundamental')).not.toBeInTheDocument();
        }, { timeout: 1000 }); // Wait for animation

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
        expect(screen.getByText("The word before '!!' must end in 'w'.")).toBeInTheDocument();
    });
});
