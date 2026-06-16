import { describe, it, expect } from 'vitest';
import { tierForPrice, tierFares } from './tiering.js';
import type { FareQuote } from '../providers/types.js';

function fare(code: string, price: number): FareQuote {
  return {
    flyFrom: 'MCO',
    flyTo: code,
    cityTo: code,
    countryTo: 'X',
    lat: 0,
    lon: 0,
    price,
    distance: 1000,
    themes: [],
    deepLink: '#',
    fetchedAt: new Date(0).toISOString(),
  };
}

describe('tierForPrice', () => {
  it('classifies cheap/fair/splurge relative to budget', () => {
    expect(tierForPrice(200, 1000)).toBe('cheap'); // <= 600
    expect(tierForPrice(800, 1000)).toBe('fair'); // <= 1000
    expect(tierForPrice(1200, 1000)).toBe('splurge'); // > 1000
  });
  it('respects a custom cheapFraction', () => {
    expect(tierForPrice(400, 1000, 0.3)).toBe('fair'); // 400 > 300
  });
});

describe('tierFares', () => {
  const fares = [
    fare('A', 150),
    fare('B', 300),
    fare('C', 700),
    fare('D', 1100),
    fare('E', 250),
  ];

  it('halos the cheapest within-budget fares as best deals', () => {
    const tiers = tierFares(fares, { budget: 1000, bestDealCount: 2 });
    expect(tiers.get('A')!.isBestDeal).toBe(true); // cheapest
    expect(tiers.get('E')!.isBestDeal).toBe(true); // 2nd cheapest
    expect(tiers.get('C')!.isBestDeal).toBe(false);
    expect(tiers.get('D')!.isBestDeal).toBe(false); // over budget, never a best deal
  });

  it('assigns tiers to every fare', () => {
    const tiers = tierFares(fares, { budget: 1000 });
    expect(tiers.get('A')!.tier).toBe('cheap');
    expect(tiers.get('D')!.tier).toBe('splurge');
    expect(tiers.size).toBe(fares.length);
  });
});
