// match-state-manager.ts is written for a browser context (localStorage
// persistence, window.dispatchEvent for cross-component signalling) even
// though its state-transition logic itself is pure, in-memory, and has
// nothing to do with the DOM. Rather than pull in jsdom/happy-dom (a real
// dependency, for two globals this file touches), stub exactly what it
// calls -- no-op is the correct behavior for a unit test that only cares
// about the resulting MatchState, not side-channel browser events.
// Always override, never just `typeof === 'undefined'`: Node 22+ ships an
// experimental native `localStorage` global that exists but throws on every
// call unless `--localstorage-file` is set, so a presence check alone
// doesn't tell you it actually works (found via this file's methods logging
// "Failed to persist/load match state" on every test despite all assertions
// passing).
const store = new Map<string, string>();
(globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
};

if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
        dispatchEvent: () => true,
    };
}
