import { describe, it, expect } from 'vitest';
import { getCard, CARD_IDS } from '../src/content/i18n';

describe('content', () => {
  it('has all 8 hotspot cards', () => {
    expect(CARD_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('returns english card', () => {
    const c = getCard(1, 'en');
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.body.length).toBeGreaterThan(20);
  });
  it('returns tajik card with cyrillic', () => {
    const c = getCard(3, 'tj');
    expect(/[Ѐ-ӿ]/.test(c.title + c.body)).toBe(true);
  });
  it('throws on unknown id', () => {
    expect(() => getCard(99, 'en')).toThrow();
  });
});
