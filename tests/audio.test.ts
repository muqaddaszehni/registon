import { describe, it, expect } from 'vitest';

// ─── Pentatonic determinism (no DOM / WebAudio needed) ────────────────────────
const PENTATONIC_RATIOS = [1, 4 / 3, 3 / 2, 5 / 3, 16 / 9, 2];
const GOLDEN = 2.39996;
const D3 = 146.83;

function pickFreq(counter: number): number {
  const idx = Math.floor(((counter * GOLDEN) % 1) * PENTATONIC_RATIOS.length);
  return D3 * PENTATONIC_RATIOS[idx];
}

function pickInterval(counter: number): number {
  return 6000 + (((counter * GOLDEN) % 1) * 6000);
}

describe('audio determinism', () => {
  it('pickFreq always returns a valid pentatonic pitch', () => {
    for (let i = 0; i < 100; i++) {
      const f = pickFreq(i);
      const ratio = f / D3;
      expect(PENTATONIC_RATIOS.some(r => Math.abs(r - ratio) < 1e-9)).toBe(true);
    }
  });

  it('pickInterval always in [6000, 12000) ms', () => {
    for (let i = 0; i < 100; i++) {
      const t = pickInterval(i);
      expect(t).toBeGreaterThanOrEqual(6000);
      expect(t).toBeLessThan(12000);
    }
  });

  it('pickFreq is deterministic (same counter → same pitch)', () => {
    expect(pickFreq(7)).toBe(pickFreq(7));
    expect(pickFreq(42)).toBe(pickFreq(42));
  });

  it('golden-angle gives good spread across pentatonic set (all 6 notes hit in first 20 notes)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const idx = Math.floor(((i * GOLDEN) % 1) * PENTATONIC_RATIOS.length);
      seen.add(idx);
    }
    expect(seen.size).toBe(PENTATONIC_RATIOS.length);
  });
});
