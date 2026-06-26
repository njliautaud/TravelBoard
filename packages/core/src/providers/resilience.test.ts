/**
 * Tests for retry and circuit-breaker resilience utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, RetryProvider } from './resilience';
import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProvider(impl: () => Promise<FareQuote[]>): FlightProvider {
  return { getCheapest: impl };
}

const dummyOpts: GetCheapestOptions = {
  origin: { code: 'MCO', lat: 28.4, lon: -81.3 },
  month: 6,
};

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

describe('CircuitBreaker', () => {
  it('starts in closed state and allows requests', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
    expect(cb.allowRequest()).toBe(true);
  });

  it('opens after reaching the failure threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    expect(cb.getState()).toBe('closed');
    expect(cb.allowRequest()).toBe(true);
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.allowRequest()).toBe(false);
  });

  it('transitions to half-open after reset timeout', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100 });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    // Simulate time passing by manipulating the internal state via reset timeout check
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    expect(cb.getState()).toBe('half-open');
    expect(cb.allowRequest()).toBe(true);
    vi.useRealTimers();
  });

  it('resets to closed on success', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
    expect(cb.allowRequest()).toBe(true);
  });

  it('manual reset clears state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// RetryProvider
// ---------------------------------------------------------------------------

describe('RetryProvider', () => {
  it('returns result on first success without retrying', async () => {
    const mockFares: FareQuote[] = [{
      flyFrom: 'MCO', flyTo: 'LAX', cityTo: 'LA',
      countryTo: 'US', price: 200, distance: 0, lat: 34, lon: -118, themes: [],
      deepLink: '', source: 'test',
      fetchedAt: new Date().toISOString(),
    }];
    const fn = vi.fn().mockResolvedValue(mockFares);
    const provider = makeMockProvider(fn);
    const retry = new RetryProvider(provider, { maxRetries: 2, initialDelayMs: 10 });
    const result = await retry.getCheapest(dummyOpts);
    expect(result).toEqual(mockFares);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure then succeeds', async () => {
    const mockFares: FareQuote[] = [];
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValueOnce(mockFares);
    const provider = makeMockProvider(fn);
    const retry = new RetryProvider(provider, { maxRetries: 2, initialDelayMs: 10 });
    const result = await retry.getCheapest(dummyOpts);
    expect(result).toEqual(mockFares);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx client errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));
    const provider = makeMockProvider(fn);
    const retry = new RetryProvider(provider, { maxRetries: 3, initialDelayMs: 10 });
    await expect(retry.getCheapest(dummyOpts)).rejects.toThrow('401');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after all retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    const provider = makeMockProvider(fn);
    const retry = new RetryProvider(provider, { maxRetries: 2, initialDelayMs: 10 });
    await expect(retry.getCheapest(dummyOpts)).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('returns empty array when circuit breaker is open', async () => {
    const fn = vi.fn().mockResolvedValue([{ flyTo: 'LAX' }]);
    const provider = makeMockProvider(fn);
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.recordFailure(); // opens the circuit
    const retry = new RetryProvider(provider, { maxRetries: 0, circuitBreaker: cb });
    const result = await retry.getCheapest(dummyOpts);
    expect(result).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('records success on circuit breaker when request succeeds', async () => {
    const fn = vi.fn().mockResolvedValue([]);
    const provider = makeMockProvider(fn);
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    const retry = new RetryProvider(provider, { maxRetries: 0, circuitBreaker: cb });
    await retry.getCheapest(dummyOpts);
    expect(cb.getState()).toBe('closed'); // success resets failures
  });

  it('records failure on circuit breaker when all retries fail', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('server down'));
    const provider = makeMockProvider(fn);
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    const retry = new RetryProvider(provider, { maxRetries: 0, circuitBreaker: cb });
    await expect(retry.getCheapest(dummyOpts)).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });
});
