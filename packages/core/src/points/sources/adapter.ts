/**
 * Points source-adapter framework (HC #602 req 3).
 *
 * Generalizes the AggregateProvider lesson — "one dead source never blanks the
 * board" — into a reusable runner for ANY points data source, because this
 * domain mostly has NO clean APIs. Adapters are dumb fetch+normalize units
 * (JSON API, RSS, HTML scrape, or static dataset); the SourceRunner wraps each
 * one with:
 *
 *   - TTL cache: serve cached data without refetching while fresh;
 *   - retry with exponential backoff + per-attempt timeout;
 *   - stale-grace degradation: when a source dies we KEEP serving the last
 *     good payload with status 'stale' (UI shows a STALE banner, never a
 *     blank or fabricated section — HC #582 spirit);
 *   - honest health: ok / stale / unavailable / unconfigured surfaced to UI.
 */

import type {
  PointsSourceAdapter,
  SourceHealth,
  SourcePersistence,
  SourceResult,
  SourceRunnerOptions,
} from '../types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SourceRunner<T> {
  private readonly adapter: PointsSourceAdapter<T>;
  private readonly ttlMs: number;
  private readonly staleGraceMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly timeoutMs: number;

  private cache: T | null = null;
  private fetchedAt: number | null = null;
  private lastError: string | null = null;
  private failureCount = 0;
  private inflight: Promise<void> | null = null;
  private readonly persist: SourcePersistence<T> | null;
  private persistLoaded = false;

  constructor(adapter: PointsSourceAdapter<T>, opts: SourceRunnerOptions<T>) {
    this.adapter = adapter;
    this.ttlMs = opts.ttlMs;
    this.staleGraceMs = opts.staleGraceMs ?? 7 * 24 * 60 * 60 * 1000; // 7d default
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 1_500;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.persist = opts.persist ?? null;
  }

  /**
   * Lazily pre-seed the cache from disk persistence (HC #604). Runs at most
   * once, only when we have no in-memory data yet, and NEVER throws — a broken
   * persistence layer must not take a working source down. Loaded data goes
   * through the normal TTL/stale-grace logic, so old persisted payloads are
   * honestly reported as 'stale' (or ignored entirely past the grace window).
   */
  private ensurePersistLoaded(): void {
    if (this.persistLoaded || !this.persist) return;
    this.persistLoaded = true;
    if (this.cache != null) return; // prime() or a fetch beat us to it
    try {
      const row = this.persist.load();
      if (row != null) {
        const ts = Date.parse(row.fetchedAt);
        if (Number.isFinite(ts)) {
          this.cache = row.data;
          this.fetchedAt = ts;
        }
      }
    } catch {
      /* best-effort: ignore persistence read failures */
    }
  }

  get id(): string {
    return this.adapter.id;
  }

  /** Inject a payload (used for tests and for pre-seeding from disk cache). */
  prime(data: T, fetchedAtIso?: string): void {
    this.cache = data;
    this.fetchedAt = fetchedAtIso ? Date.parse(fetchedAtIso) : Date.now();
  }

  health(): SourceHealth {
    this.ensurePersistLoaded();
    const now = Date.now();
    const configured = this.adapter.configured?.() ?? true;
    const age = this.fetchedAt != null ? now - this.fetchedAt : null;
    let status: SourceHealth['status'];
    if (!configured) status = 'unconfigured';
    else if (this.cache != null && age != null && age <= this.ttlMs) status = 'ok';
    else if (this.cache != null && age != null && age <= this.ttlMs + this.staleGraceMs) status = 'stale';
    else status = 'unavailable';
    return {
      id: this.adapter.id,
      kind: this.adapter.kind,
      status,
      lastSuccessAt: this.fetchedAt != null ? new Date(this.fetchedAt).toISOString() : null,
      dataAgeMs: age,
      lastError: this.lastError,
      failureCount: this.failureCount,
    };
  }

  /**
   * Get data, refreshing if past TTL. NEVER throws: failures degrade to
   * stale (if we have history) or `data: null` with honest health.
   */
  async get(): Promise<SourceResult<T>> {
    this.ensurePersistLoaded();
    const configured = this.adapter.configured?.() ?? true;
    if (configured) {
      const age = this.fetchedAt != null ? Date.now() - this.fetchedAt : Infinity;
      if (this.cache == null || age > this.ttlMs) {
        // single-flight: concurrent callers share one refresh
        this.inflight ??= this.refresh().finally(() => { this.inflight = null; });
        await this.inflight;
      }
    }
    const h = this.health();
    return {
      data: h.status === 'ok' || h.status === 'stale' ? this.cache : null,
      health: h,
      fetchedAt: h.lastSuccessAt,
    };
  }

  private async refresh(): Promise<void> {
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const data = await withTimeout(this.adapter.fetch(), this.timeoutMs, this.adapter.id);
        this.cache = data;
        this.fetchedAt = Date.now();
        this.lastError = null;
        this.failureCount = 0;
        if (this.persist) {
          try {
            this.persist.save(data, new Date(this.fetchedAt).toISOString());
          } catch {
            /* best-effort: a broken persistence layer never breaks a good fetch */
          }
        }
        return;
      } catch (err) {
        this.lastError = (err as Error).message ?? String(err);
        this.failureCount++;
        if (attempt < this.retries) await sleep(this.backoffMs * 2 ** attempt);
      }
    }
    // all attempts failed — keep old cache (stale-grace); health() reports honestly
  }
}

/** Shared fetch helper for HTML/RSS adapters — several sources 403 default UAs. */
export const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': BROWSER_UA, accept: 'text/html,application/xhtml+xml,application/xml,*/*', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}
