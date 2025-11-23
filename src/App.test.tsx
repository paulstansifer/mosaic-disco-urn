import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Interaction', () => {
    it('renders the initial sentence', () => {
        const { container } = render(<App />);
        const wordRow = container.querySelector('.word-row');
        expect(wordRow).toHaveTextContent('I');
        expect(wordRow).toHaveTextContent('fundamental');
        expect(wordRow).toHaveTextContent('!!');
    });

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

    it('commits the word on Enter', async () => {
        const user = userEvent.setup();
        render(<App />);

        await user.click(screen.getByRole('button', { name: '+' }));
        // 'hello' is a valid word from the list
        await user.keyboard('hello{Enter}');

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

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
    it('displays initial validation errors on render', () => {
        render(<App />);
        expect(screen.getByText("There must be exactly one eight-letter word.")).toBeInTheDocument();
        expect(screen.getByText("The word before '!!' must end in 'w'.")).toBeInTheDocument();
    });
});
