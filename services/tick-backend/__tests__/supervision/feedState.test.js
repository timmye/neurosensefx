import { describe, it, expect } from 'vitest';
const { FeedState, FeedStates } = require('../../supervision/FeedState');

describe('FeedState (B1)', () => {
    it('starts DISCONNECTED and exposes the state constants', () => {
        const fs = new FeedState();
        expect(fs.current).toBe(FeedStates.DISCONNECTED);
        expect(FeedStates.CONNECTING).toBe('CONNECTING');
        expect(FeedStates.HANDSHAKING).toBe('HANDSHAKING');
    });

    it('allows all legal transitions and updates `since`', () => {
        let t = 1000;
        const fs = new FeedState({ now: () => t });
        expect(fs.since).toBe(1000);

        t = 2000;
        fs.transition(FeedStates.CONNECTING);
        expect(fs.current).toBe(FeedStates.CONNECTING);
        expect(fs.since).toBe(2000);

        t = 3000;
        fs.transition(FeedStates.HANDSHAKING);
        expect(fs.current).toBe(FeedStates.HANDSHAKING);

        t = 4000;
        fs.transition(FeedStates.CONNECTED);
        expect(fs.current).toBe(FeedStates.CONNECTED);

        t = 5000;
        fs.transition(FeedStates.DEGRADED);
        expect(fs.current).toBe(FeedStates.DEGRADED);

        t = 6000;
        fs.transition(FeedStates.CONNECTED); // recovered
        expect(fs.current).toBe(FeedStates.CONNECTED);

        t = 7000;
        fs.transition(FeedStates.BACKOFF);
        t = 8000;
        fs.transition(FeedStates.CONNECTING);
        expect(fs.current).toBe(FeedStates.CONNECTING);
    });

    it('throws on illegal direct transitions', () => {
        const fs = new FeedState();
        // CONNECTED directly from DISCONNECTED is illegal (must go via CONNECTING).
        expect(() => fs.transition(FeedStates.CONNECTED)).toThrow(/illegal transition/);

        fs.transition(FeedStates.CONNECTING);
        fs.transition(FeedStates.HANDSHAKING);
        fs.transition(FeedStates.CONNECTED);
        // CONNECTED → CONNECTING is illegal (must go via BACKOFF/DISCONNECTED).
        expect(() => fs.transition(FeedStates.CONNECTING)).toThrow(/illegal transition/);
        // CONNECTED → HANDSHAKING is illegal.
        expect(() => fs.transition(FeedStates.HANDSHAKING)).toThrow(/illegal transition/);
    });

    it('throws on unknown state names', () => {
        const fs = new FeedState();
        expect(() => fs.transition('DEAD')).toThrow(/unknown state/);
        expect(() => fs.transition('BOGUS')).toThrow(/unknown state/);
    });

    it('canTransition reports legality without mutating', () => {
        const fs = new FeedState();
        expect(fs.canTransition(FeedStates.CONNECTING)).toBe(true);
        expect(fs.canTransition(FeedStates.CONNECTED)).toBe(false);
        expect(fs.current).toBe(FeedStates.DISCONNECTED); // unchanged
    });

    it('has no dead-ends: every state can reach CONNECTING', () => {
        // From each state, walk the legal transitions and confirm CONNECTING is
        // reachable (CONNECTING itself trivially counts as "at CONNECTING").
        function reachableFrom(state) {
            if (state === FeedStates.CONNECTING) return true;
            const seen = new Set();
            const stack = [state];
            while (stack.length) {
                const s = stack.pop();
                if (s === FeedStates.CONNECTING) return true;
                if (seen.has(s)) continue;
                seen.add(s);
                // LEGAL_TRANSITIONS is internal; mirror it here for the proof.
                const next = {
                    DISCONNECTED: [FeedStates.CONNECTING],
                    CONNECTING: [FeedStates.HANDSHAKING, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
                    HANDSHAKING: [FeedStates.CONNECTED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
                    CONNECTED: [FeedStates.DEGRADED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
                    DEGRADED: [FeedStates.CONNECTED, FeedStates.BACKOFF, FeedStates.DISCONNECTED],
                    BACKOFF: [FeedStates.CONNECTING],
                }[s] || [];
                for (const n of next) stack.push(n);
            }
            return false;
        }
        for (const s of Object.values(FeedStates)) {
            expect(reachableFrom(s)).toBe(true);
        }
    });

    it('emits a transition event with from/to/since', () => {
        let t = 100;
        const fs = new FeedState({ now: () => t });
        const events = [];
        fs.on('transition', (e) => events.push(e));
        t = 200;
        fs.transition(FeedStates.CONNECTING);
        expect(events).toEqual([{ from: 'DISCONNECTED', to: 'CONNECTING', since: 200 }]);
    });
});
