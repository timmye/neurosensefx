/**
 * Symbol Status Message Tests
 *
 * Tests for the per-symbol no-data status helpers in symbolStatusMessage.js:
 *   resolveSymbolStatus, symbolStatusMessage, tickerSymbolStatus
 *
 * Run: npm run test:unit -- src/lib/__tests__/symbolStatusMessage.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  resolveSymbolStatus,
  symbolStatusMessage,
  tickerSymbolStatus,
} from '../symbolStatusMessage.js';

// ── resolveSymbolStatus ──

describe('resolveSymbolStatus', () => {
  it('returns null when price data is present (healthy — render normally)', () => {
    expect(resolveSymbolStatus('connected', true, true)).toBe(null);
    // Even an error status yields to data already on screen
    expect(resolveSymbolStatus('error', true, true)).toBe(null);
  });

  it('returns "offline" when the socket is down, regardless of per-symbol status', () => {
    expect(resolveSymbolStatus('error', false, false)).toBe('offline');
    expect(resolveSymbolStatus('pending', false, false)).toBe('offline');
    expect(resolveSymbolStatus('connected', false, false)).toBe('offline');
  });

  it('returns "error" for a per-symbol error with no data and socket up', () => {
    expect(resolveSymbolStatus('error', false, true)).toBe('error');
  });

  it('returns "pending" while resolving with no data and socket up', () => {
    expect(resolveSymbolStatus('pending', false, true)).toBe('pending');
  });

  it('returns null for an unknown/healthy status with no data and socket up', () => {
    expect(resolveSymbolStatus('connected', false, true)).toBe(null);
    expect(resolveSymbolStatus('stale', false, true)).toBe(null);
    expect(resolveSymbolStatus(undefined, false, true)).toBe(null);
  });

  it('defaults globalConnected to true when omitted', () => {
    expect(resolveSymbolStatus('error', false)).toBe('error');
    expect(resolveSymbolStatus('pending', false)).toBe('pending');
  });
});

// ── symbolStatusMessage (canvas display variant) ──

describe('symbolStatusMessage', () => {
  it('returns "No data available" for a per-symbol error with no data', () => {
    expect(symbolStatusMessage('error', { hasData: false, globalConnected: true })).toBe('No data available');
  });

  it('returns "Resolving {symbol}…" for the pending state', () => {
    expect(symbolStatusMessage('pending', { hasData: false, symbol: 'EURUSD', globalConnected: true })).toBe('Resolving EURUSD…');
  });

  it('falls back to "symbol" when no symbol is provided in pending', () => {
    expect(symbolStatusMessage('pending', { hasData: false, globalConnected: true })).toBe('Resolving symbol…');
  });

  it('returns a disconnected message when the socket is down', () => {
    expect(symbolStatusMessage('error', { hasData: false, globalConnected: false })).toBe('Disconnected from server');
    expect(symbolStatusMessage('pending', { hasData: false, symbol: 'EURUSD', globalConnected: false })).toBe('Disconnected from server');
  });

  it('returns null once data has arrived (render normally)', () => {
    expect(symbolStatusMessage('connected', { hasData: true, symbol: 'EURUSD' })).toBe(null);
    expect(symbolStatusMessage('error', { hasData: true, symbol: 'EURUSD' })).toBe(null);
  });

  it('returns null for a healthy/unknown status with no data', () => {
    expect(symbolStatusMessage('connected', { hasData: false, symbol: 'EURUSD' })).toBe(null);
    expect(symbolStatusMessage(undefined, { hasData: false })).toBe(null);
  });
});

// ── tickerSymbolStatus (terse ticker variant) ──

describe('tickerSymbolStatus', () => {
  it('returns "No data" (terse) for a per-symbol error with no data', () => {
    expect(tickerSymbolStatus('error', { hasData: false, globalConnected: true })).toBe('No data');
  });

  it('returns "Offline" when the socket is down', () => {
    expect(tickerSymbolStatus('error', { hasData: false, globalConnected: false })).toBe('Offline');
    expect(tickerSymbolStatus('pending', { hasData: false, globalConnected: false })).toBe('Offline');
  });

  it('returns null for pending so the ticker keeps the symbol + "…" placeholder (§6.1)', () => {
    expect(tickerSymbolStatus('pending', { hasData: false, globalConnected: true })).toBe(null);
  });

  it('returns null once data has arrived', () => {
    expect(tickerSymbolStatus('connected', { hasData: true })).toBe(null);
    expect(tickerSymbolStatus('error', { hasData: true })).toBe(null);
  });

  it('returns null for a healthy/unknown status with no data', () => {
    expect(tickerSymbolStatus('connected', { hasData: false })).toBe(null);
    expect(tickerSymbolStatus(undefined, { hasData: false })).toBe(null);
  });
});
