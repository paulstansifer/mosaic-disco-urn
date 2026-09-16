import React, { useState } from 'react';
import { formatSyncCode, normalizeSyncCode } from './syncCode';
import type { SyncStatus } from './sync';

interface SyncPanelProps {
    syncCode: string | null;
    status: SyncStatus | null;
    // Both reject with a message to show the user, such as an unassigned code.
    onCreate: () => Promise<void>;
    onJoin: (code: string) => Promise<void>;
    onStop: () => void;
}

// Nothing for 'synced': the green dot and "Synced with code" already say it.
const statusText = (status: SyncStatus | null): string | null => {
    switch (status?.state) {
        case 'synced': return null;
        case 'offline': return 'offline; will sync when reconnected';
        case 'error': return status.message;
        default: return 'connecting…';
    }
};

const SyncPanel: React.FC<SyncPanelProps> = ({ syncCode, status, onCreate, onJoin, onStop }) => {
    const [expanded, setExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setInputError(null);
        try {
            await action();
        } catch (e) {
            setInputError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    if (syncCode) {
        const formatted = formatSyncCode(syncCode);
        const message = statusText(status);
        return (
            <div className="sync-panel">
                <span className={`sync-status-dot ${status?.state ?? 'connecting'}`} />
                <span>
                    Synced with code <code className="sync-code">{formatted}</code>
                </span>
                <button
                    className="sync-btn"
                    onClick={() => navigator.clipboard?.writeText(formatted).catch(console.error)}
                    title="Copy sync code"
                >
                    <span className="material-icons-outlined">content_copy</span>
                </button>
                <button className="sync-btn" onClick={onStop} title="Stop syncing this device">
                    Stop syncing
                </button>
                {message && (
                    <span className={`sync-status-text ${status?.state ?? 'connecting'}`}>{message}</span>
                )}
            </div>
        );
    }

    if (!expanded) {
        return (
            <div className="sync-panel">
                <button className="sync-btn" onClick={() => setExpanded(true)}>
                    Sync with another device
                </button>
            </div>
        );
    }

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        const code = normalizeSyncCode(input);
        if (!code) {
            setInputError('Codes are 6 letters and digits, like K7Q-M3X.');
            return;
        }
        run(() => onJoin(code));
    };

    return (
        <div className="sync-panel">
            <button
                className="sync-btn"
                onClick={() => run(onCreate)}
                disabled={busy}
                title="Create a new sync code for this device"
            >
                New code
            </button>
            <span>or</span>
            <form onSubmit={handleJoin} className="sync-join-form">
                <input
                    className="sync-code-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Enter code"
                    aria-label="Sync code"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy}
                />
                <button type="submit" className="sync-btn" disabled={busy}>
                    {busy ? 'Checking…' : 'Merge and sync'}
                </button>
            </form>
            <span>or</span>
            <button className="sync-btn" onClick={() => setExpanded(false)} disabled={busy}>Cancel</button>
            {inputError && <span className="sync-status-text error">{inputError}</span>}
        </div>
    );
};

export default SyncPanel;
