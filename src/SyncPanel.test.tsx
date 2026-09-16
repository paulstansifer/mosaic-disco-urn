import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SyncPanel from './SyncPanel';

describe('SyncPanel', () => {
    const handlers = () => ({
        onCreate: vi.fn().mockResolvedValue(undefined),
        onJoin: vi.fn().mockResolvedValue(undefined),
        onStop: vi.fn(),
    });

    it('joins with a normalized code', async () => {
        const user = userEvent.setup();
        const h = handlers();
        render(<SyncPanel syncCode={null} status={null} {...h} />);

        await user.click(screen.getByRole('button', { name: 'Sync with another device' }));
        await user.type(screen.getByLabelText('Sync code'), 'k7q-m3x');
        await user.click(screen.getByRole('button', { name: 'Merge and sync' }));

        expect(h.onJoin).toHaveBeenCalledWith('K7QM3X');
    });

    it('rejects a malformed code', async () => {
        const user = userEvent.setup();
        const h = handlers();
        render(<SyncPanel syncCode={null} status={null} {...h} />);

        await user.click(screen.getByRole('button', { name: 'Sync with another device' }));
        await user.type(screen.getByLabelText('Sync code'), 'nope');
        await user.click(screen.getByRole('button', { name: 'Merge and sync' }));

        expect(h.onJoin).not.toHaveBeenCalled();
        expect(screen.getByText(/Codes are 6 letters and digits/)).toBeInTheDocument();
    });

    it('creates a new code', async () => {
        const user = userEvent.setup();
        const h = handlers();
        render(<SyncPanel syncCode={null} status={null} {...h} />);

        await user.click(screen.getByRole('button', { name: 'Sync with another device' }));
        await user.click(screen.getByRole('button', { name: 'New code' }));

        expect(h.onCreate).toHaveBeenCalled();
    });

    it('reports a code the app refused, such as one nobody has used', async () => {
        const user = userEvent.setup();
        const h = handlers();
        h.onJoin.mockRejectedValue(new Error("K7Q-M3X hasn't been assigned. Check it, or make a new code."));
        render(<SyncPanel syncCode={null} status={null} {...h} />);

        await user.click(screen.getByRole('button', { name: 'Sync with another device' }));
        await user.type(screen.getByLabelText('Sync code'), 'k7q-m3x');
        await user.click(screen.getByRole('button', { name: 'Merge and sync' }));

        expect(await screen.findByText(/hasn't been assigned/)).toBeInTheDocument();
        // The field stays usable so the code can be corrected.
        expect(screen.getByLabelText('Sync code')).toBeEnabled();
    });

    it('shows the code and status while syncing', async () => {
        const user = userEvent.setup();
        const h = handlers();
        render(<SyncPanel syncCode="K7QM3X" status={{ state: 'error', message: 'Permission denied' }} {...h} />);

        expect(screen.getByText('K7Q-M3X')).toBeInTheDocument();
        expect(screen.getByText('Permission denied')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Stop syncing' }));
        expect(h.onStop).toHaveBeenCalled();
    });
});
