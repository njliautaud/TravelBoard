import { describe, it, expect } from 'vitest';
import { AggregateProvider } from './aggregate';
import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';

const OPTS: GetCheapestOptions = { origin: { code: 'MCO', lat: 28.43, lon: -81.31 }, month: 6 };

function q(partial: Partial<FareQuote>): FareQuote {
  return {
    flyFrom: 'MCO',
    flyTo: 'LIS',
    cityTo: 'Lisbon',
    countryTo: 'Portugal',
    lat: 38.77,
    lon: -9.13,
    price: 500,
    distance: 4241,
    themes: ['beach'],
    deepLink: 'https://example.com',
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function fakeProvider(quotes: FareQuote[]): FlightProvider {
  return { getCheapest: async () => quotes };
}

function failingProvider(msg: string): FlightProvider {
  return { getCheapest: async () => { throw new Error(msg); } };
}

describe('AggregateProvider', () => {
  it('merges the same destination from multiple sources to one canonical offer with best price + attribution', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'a', provider: fakeProvider([q({ price: 520 })]) },
        { name: 'b', provider: fakeProvider([q({ price: 480 })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out).toHaveLength(1);
    expect(out[0]!.price).toBe(480);
    expect(out[0]!.source).toBe('b');
    expect(out[0]!.sources!.sort()).toEqual(['a', 'b']);
    expect(out[0]!.priceBySource).toEqual({ a: 520, b: 480 });
  });

  it('keeps distinct destinations from different sources (union widens coverage)', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'a', provider: fakeProvider([q({ flyTo: 'LIS' })]) },
        { name: 'b', provider: fakeProvider([q({ flyTo: 'NRT', cityTo: 'Tokyo', countryTo: 'Japan' })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out.map((x) => x.flyTo).sort()).toEqual(['LIS', 'NRT']);
  });

  it('survives a failing source (graceful degradation, never a blank wall)', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'dead', provider: failingProvider('boom') },
        { name: 'alive', provider: fakeProvider([q({})]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out).toHaveLength(1);
    expect(agg.lastRunStats.find((s) => s.source === 'dead')!.ok).toBe(false);
    expect(agg.lastRunStats.find((s) => s.source === 'alive')!.ok).toBe(true);
  });

  it('throws only when EVERY source fails', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'x', provider: failingProvider('x down') },
        { name: 'y', provider: failingProvider('y down') },
      ],
    });
    await expect(agg.getCheapest(OPTS)).rejects.toThrow(/all aggregate sources failed/);
  });

  it('rejects glitch prices absurdly below the cross-source median', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'a', provider: fakeProvider([q({ price: 500 })]) },
        { name: 'b', provider: fakeProvider([q({ price: 510 })]) },
        { name: 'glitch', provider: fakeProvider([q({ price: 3 })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out[0]!.price).toBe(500); // $3 quote rejected as glitch, not a "deal"
  });

  it('backfills coords/themes/transfers from richer sources when the winner lacks them', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'cheap-but-bare', provider: fakeProvider([q({ price: 400, lat: 0, lon: 0, themes: [], transfers: null })]) },
        { name: 'rich', provider: fakeProvider([q({ price: 450, transfers: 0 })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out[0]!.price).toBe(400);
    expect(out[0]!.lat).toBeCloseTo(38.77, 1);
    expect(out[0]!.themes).toContain('beach');
    expect(out[0]!.transfers).toBe(0);
  });

  it('HC #618 R4 — preserves round-trip tripType from the winning quote so cards label honestly', async () => {
    const agg = new AggregateProvider({
      sources: [
        { name: 'kiwi', provider: fakeProvider([q({ price: 480, tripType: 'round-trip' })]) },
        { name: 'tp', provider: fakeProvider([q({ price: 520, tripType: 'round-trip' })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out[0]!.tripType).toBe('round-trip');
  });

  it('HC #618 R4 — never silently relabels a one-way as round-trip', async () => {
    const agg = new AggregateProvider({
      sources: [
        // winner is one-way; aggregate must not pretend it's round-trip
        { name: 'oneway', provider: fakeProvider([q({ price: 200, tripType: 'one-way' })]) },
        { name: 'rt', provider: fakeProvider([q({ price: 480, tripType: 'round-trip' })]) },
      ],
    });
    const out = await agg.getCheapest(OPTS);
    expect(out[0]!.price).toBe(200);
    expect(out[0]!.tripType).toBe('one-way');
  });
});
