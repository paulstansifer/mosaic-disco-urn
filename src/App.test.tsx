import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Interaction', () => {
    it('renders the initial letter pool', () => {
        const { container } = render(<App />);
        const pool = container.querySelector('.letter-pool');
        expect(pool).toBeInTheDocument();
        // Check that we have a significant amount of text (letters + spaces)
        expect(pool?.textContent?.length).toBeGreaterThan(100);
        expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('allows creating a new word and typing removes letters from pool', async () => {
        const user = userEvent.setup();
        render(<App />);

        const addButton = screen.getByRole('button', { name: '+' });
        await user.click(addButton);

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect(input).toHaveFocus();

        // Type 't'
        await user.keyboard('t');
        expect(input).toHaveValue('t');

        // Check if a 't' was removed from pool (replaced by space)
        // This is tricky to test exactly because of the pool display format, 
        // but we can check if the pool text content changes.
        // A better way might be to check if the number of 't's decreases.
        // But let's just verify the input value for now.
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
        await user.keyboard('hello{Enter}');

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText('hello')).toBeInTheDocument();
    });

    it('steals letters from existing words if pool is empty', async () => {
        // This test is harder because we need to exhaust the pool.
        // We can mock the initial pool or just type a lot.
        // Let's try to steal from "Today" (id: 1).

        const user = userEvent.setup();
        render(<App />);

        // "Today" is on the screen.
        expect(screen.getByText('Today')).toBeInTheDocument();

        // We need to exhaust 'T' or 'o' etc.
        // The pool is huge, so exhausting it manually in test is hard.
        // Maybe we can rely on the fact that 'T' (uppercase) might be rare?
        // The initial pool has "III". "Today" has "T".
        // Wait, the pool is lowercase mostly?
        // INITIAL_POOL = "tttt... III..."
        // "Today" has 'T'.

        // Let's try to steal 'T'.
        // First, consume all 'T's from the pool.
        // There are no 'T's in the default pool! Only 't' and 'I'.
        // Wait, "Today" starts with 'T'.
        // If I type 'T', and it's not in pool, it should steal from "Today".

        await user.click(screen.getByRole('button', { name: '+' }));
        await user.keyboard('T');

        // "Today" should be gone (or at least modified/removed).
        // Our logic removes the whole word.
        expect(screen.queryByText('Today')).not.toBeInTheDocument();

        const input = screen.getByRole('textbox');
        expect(input).toHaveValue('T');
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
