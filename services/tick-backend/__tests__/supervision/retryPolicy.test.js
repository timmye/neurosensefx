import { describe, it, expect } from 'vitest';
const { RetryPolicy } = require('../../supervision/RetryPolicy');

describe('RetryPolicy (B1)', () => {
    it('follows the exponential curve for small attempt counts (no jitter)', () => {
        // random() => 0 ⇒ zero jitter, so delayFor == baseDelay exactly.
        const p = new RetryPolicy({ initialDelay: 500, maxDelay: 15000, factor: 2, random: () => 0 });
        expect(p.delayFor(0)).toBe(500);
        expect(p.delayFor(1)).toBe(1000);
        expect(p.delayFor(2)).toBe(2000);
        expect(p.delayFor(3)).toBe(4000);
        expect(p.delayFor(4)).toBe(8000);
    });

    it('caps the base delay at maxDelay', () => {
        const p = new RetryPolicy({ initialDelay: 500, maxDelay: 15000, factor: 2, random: () => 0 });
        // 500 * 2^5 = 16000 → capped at 15000.
        expect(p.baseDelay(5)).toBe(15000);
        expect(p.delayFor(5)).toBe(15000); // no jitter here
    });

    it('jitter stays within [base, base*(1+jitter))', () => {
        const p = new RetryPolicy({ initialDelay: 1000, maxDelay: 15000, factor: 2, jitter: 0.3, random: () => 1 });
        // random()=1 ⇒ full jitter ⇒ delay = base + 0.3*base = base*1.3
        expect(p.delayFor(0)).toBeCloseTo(1300, 5);
        const p0 = new RetryPolicy({ initialDelay: 1000, maxDelay: 15000, factor: 2, jitter: 0.3, random: () => 0.5 });
        expect(p0.delayFor(0)).toBeCloseTo(1150, 5);
    });

    it('never returns a terminal — finite for very large attempt counts', () => {
        const p = new RetryPolicy({ random: () => 0.5 });
        for (const a of [0, 1, 5, 50, 1000, 100000]) {
            const d = p.delayFor(a);
            expect(Number.isFinite(d)).toBe(true);
            expect(d).toBeGreaterThan(0);
            expect(d).toBeLessThanOrEqual(p.maxDelay * (1 + p.jitter));
        }
    });

    it('isPlateau flips true once the base delay reaches maxDelay', () => {
        const p = new RetryPolicy({ initialDelay: 500, maxDelay: 15000, factor: 2, random: () => 0 });
        // 500*2^4 = 8000 (not plateau), 500*2^5 = 16000→cap 15000 (plateau).
        expect(p.isPlateau(4)).toBe(false);
        expect(p.isPlateau(5)).toBe(true);
        expect(p.isPlateau(1000)).toBe(true);
    });

    it('delayFor(0) is near initialDelay', () => {
        const p = new RetryPolicy({ initialDelay: 500, random: () => 0 });
        expect(p.delayFor(0)).toBe(500);
    });
});
