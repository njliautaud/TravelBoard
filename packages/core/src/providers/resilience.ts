/**
 * Retry and circuit-breaker utilities for flight data providers.
 *
 * - RetryProvider wraps any FlightProvider with exponential backoff retry.
 * - CircuitBreaker tracks failures and short-circuits when a provider is
 *   consistently failing (avoids hammering a down upstream).
 *
 * Both are composable: wrap a provider in RetryProvider, then feed it to
 * AggregateProvider. The aggregate's allSettled already tolerates individual
 * source failures — the circuit breaker just makes the failure fast instead
 * of waiting for timeouts each time.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types.js';

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** How many consecutive failures before opening the circuit (default 3). */
  failureThreshold?: number;
  /** How long (ms) to stay open before allowing a probe request (default 60_000). */
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold: number;
  private readonly resetMs: number;

  constructor(opts?: CircuitBreakerOptions) {
    this.threshold = opts?.failureThreshold ?? 3;
    this.resetMs = opts?.resetTimeoutMs ?? 60_000;
  }

  getState(): CircuitState {
    if (this.state === 'open' && Date.now() - this.lastFailure >= this.resetMs) {
      return 'half-open';
    }
    return this.state;
  }

  /** Returns true if the request should be allowed through. */
  allowRequest(): boolean {
    const s = this.getState();
    return s === 'closed' || s === 'half-open';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  /** Reset to closed (e.g. on manual recovery). */
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailure = 0;
  }
}

// ---------------------------------------------------------------------------
// Retry logic (exponential backoff)
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Max number of retry attempts AFTER the first call (default 2 → 3 total attempts). */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default 500). Doubled each subsequent retry. */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms (default 5_000). */
  maxDelayMs?: number;
  /** Circuit breaker instance (shared across calls). If omitted, no circuit breaker. */
  circuitBreaker?: CircuitBreaker;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wraps a FlightProvider with retry + optional circuit breaker.
 * If the circuit is open, returns an empty result immediately rather than
 * throwing — the AggregateProvider can still serve results from other sources.
 */
export class RetryProvider implements FlightProvider {
  readonly inner: FlightProvider;
  private readonly maxRetries: number;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly cb: CircuitBreaker | null;

  constructor(inner: FlightProvider, opts?: RetryOptions) {
    this.inner = inner;
    this.maxRetries = opts?.maxRetries ?? 2;
    this.initialDelay = opts?.initialDelayMs ?? 500;
    this.maxDelay = opts?.maxDelayMs ?? 5_000;
    this.cb = opts?.circuitBreaker ?? null;
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    // Circuit breaker: fast-fail when the provider is known to be down.
    if (this.cb && !this.cb.allowRequest()) {
      return []; // graceful degradation — AggregateProvider will merge other sources
    }

    let lastError: Error | null = null;
    let delay = this.initialDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.inner.getCheapest(opts);
        this.cb?.recordSuccess();
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on 4xx client errors (bad request, auth) — only transient failures.
        if (lastError.message.includes('400') || lastError.message.includes('401') || lastError.message.includes('403')) {
          this.cb?.recordFailure();
          throw lastError;
        }

        if (attempt < this.maxRetries) {
          await sleep(delay);
          delay = Math.min(delay * 2, this.maxDelay);
        }
      }
    }

    // All retries exhausted.
    this.cb?.recordFailure();
    throw lastError!;
  }
}
