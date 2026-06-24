import { describe, it, expect } from 'vitest';
const { HealthSensor, HealthStatus } = require('../../supervision/HealthSensor');

describe('HealthSensor (B1)', () => {
    // Helper: a sensor with a controllable clock.
    function makeSensor(opts = {}) {
        let t = 0;
        const now = () => t;
        const sensor = new HealthSensor({ now, dataStaleMs: 60, heartbeatStaleMs: 30, ...opts });
        const advance = (ms) => { t += ms; };
        return { sensor, advance, now, get t() { return t; }, setT(v) { t = v; } };
    }

    it('is UNKNOWN until started', () => {
        const { sensor } = makeSensor();
        expect(sensor.compute()).toBe(HealthStatus.UNKNOWN);
        expect(sensor.check()).toBe(HealthStatus.UNKNOWN);
    });

    it('is HEALTHY while data ticks arrive within threshold', () => {
        const { sensor, advance } = makeSensor();
        sensor.start(0);
        advance(10);
        sensor.recordDataTick();
        advance(20);
        expect(sensor.check()).toBe(HealthStatus.HEALTHY);
    });

    it('goes DEGRADED when data is stale but heartbeats are fresh', () => {
        const { sensor, advance } = makeSensor();
        const degraded = [];
        sensor.on('degraded', () => degraded.push(true));
        sensor.start(0);
        // Data goes stale (past 60ms) but heartbeat still fresh (< 30ms window).
        advance(70);
        sensor.recordHeartbeat(); // heartbeat at t=70
        advance(10); // t=80: data last at 0 (80ms ago > 60 ⇒ stale), heartbeat at 70 (10ms ago < 30 ⇒ fresh)
        expect(sensor.check()).toBe(HealthStatus.DEGRADED);
        expect(degraded).toHaveLength(1);
    });

    it('goes STALE when both data and heartbeat are stale', () => {
        const { sensor, advance } = makeSensor();
        const stale = [];
        sensor.on('stale', () => stale.push(true));
        sensor.start(0);
        advance(100); // both well past thresholds (60/30)
        expect(sensor.check()).toBe(HealthStatus.STALE);
        expect(stale).toHaveLength(1);
    });

    it('detects never-received-data as STALE after the threshold', () => {
        const { sensor, advance } = makeSensor();
        sensor.start(0);
        // No recordDataTick, no recordHeartbeat ever.
        advance(100);
        expect(sensor.check()).toBe(HealthStatus.STALE);
    });

    it('emits resumed only when recovering to HEALTHY from DEGRADED/STALE', () => {
        const { sensor, advance } = makeSensor();
        const resumed = [];
        sensor.on('resumed', () => resumed.push(true));
        sensor.start(0);
        advance(100);
        expect(sensor.check()).toBe(HealthStatus.STALE); // no resumed yet
        expect(resumed).toHaveLength(0);
        sensor.recordDataTick(); // fresh data again
        expect(sensor.check()).toBe(HealthStatus.HEALTHY);
        expect(resumed).toHaveLength(1);
    });

    it('emits events only on status transitions, not every check', () => {
        const { sensor, advance } = makeSensor();
        let staleCount = 0;
        sensor.on('stale', () => { staleCount++; });
        sensor.start(0);
        advance(100);
        sensor.check(); // STALE (transition ⇒ emit)
        sensor.check(); // still STALE (no emit)
        sensor.check(); // still STALE (no emit)
        expect(staleCount).toBe(1);
    });

    it('stop() returns status to UNKNOWN', () => {
        const { sensor } = makeSensor();
        sensor.start(0);
        expect(sensor.status).toBe(HealthStatus.HEALTHY);
        sensor.stop();
        expect(sensor.status).toBe(HealthStatus.UNKNOWN);
        expect(sensor.compute()).toBe(HealthStatus.UNKNOWN);
    });
});
