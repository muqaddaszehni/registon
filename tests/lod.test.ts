import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock THREE.CanvasTexture
vi.mock('three', () => {
  class MockCanvasTexture {
    needsUpdate = false;
    image: HTMLCanvasElement;
    constructor(cv: HTMLCanvasElement) { this.image = cv; }
    clone() {
      const c = new MockCanvasTexture(this.image);
      return c;
    }
    dispose() { /* no-op in tests */ }
  }
  return { CanvasTexture: MockCanvasTexture };
});

// Mock document.createElement for canvas
const makeCanvas = (w: number, h: number) => {
  const cv = { width: w, height: h, getContext: () => ({
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }) } as unknown as HTMLCanvasElement;
  return cv;
};

import { TextureRegistry } from '../src/scene/lod';

describe('TextureRegistry', () => {
  let reg: TextureRegistry;

  beforeEach(() => { reg = new TextureRegistry(); });

  it('registers an entry with draw closure', () => {
    const cv = makeCanvas(512, 512);
    const draw = vi.fn();
    const tex = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex]);
    expect(reg.entries).toHaveLength(1);
    expect(reg.entries[0].draw).toBe(draw);
    expect(reg.entries[0].baseW).toBe(512);
    expect(reg.entries[0].baseH).toBe(512);
  });

  it('addTexture appends to existing entry', () => {
    const cv = makeCanvas(512, 512);
    const draw = vi.fn();
    const tex1 = { needsUpdate: false, image: cv } as any;
    const tex2 = { needsUpdate: false, image: cv } as any;
    reg.register(cv, draw, 512, 512, [tex1]);
    reg.addTexture(cv, tex2);
    expect(reg.entries[0].textures).toHaveLength(2);
  });

  it('buildQueue returns entries sorted by priority (tier 2)', () => {
    const cv1 = makeCanvas(512, 512);
    const cv2 = makeCanvas(512, 512);
    const draw = vi.fn();
    reg.register(cv1, draw, 512, 512, [{ needsUpdate: false, image: cv1, dispose: vi.fn() } as any], true);
    reg.register(cv2, draw, 512, 512, [{ needsUpdate: false, image: cv2, dispose: vi.fn() } as any], false);
    const queue = reg.buildQueue(2);
    // Priority entries come first
    expect(queue[0].priority).toBe(true);
  });

  it('applyScale resizes canvas and marks all textures needsUpdate', () => {
    const ctx = { fillStyle: '', fillRect: vi.fn() };
    const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const draw = vi.fn();
    const tex1 = { needsUpdate: false, image: cv, dispose: vi.fn() } as any;
    const tex2 = { needsUpdate: false, image: cv, dispose: vi.fn() } as any;
    reg.register(cv, draw, 512, 512, [tex1, tex2]);

    reg.applyScale(reg.entries[0], 2);

    expect(cv.width).toBe(1024);
    expect(cv.height).toBe(1024);
    expect(draw).toHaveBeenCalledWith(ctx, 1024, 1024);
    expect(tex1.needsUpdate).toBe(true);
    expect(tex2.needsUpdate).toBe(true);
  });
});

describe('Tier switching', () => {
  it('LOD_THRESHOLD = 0.55', async () => {
    const { LOD_THRESHOLD } = await import('../src/scene/lod');
    expect(LOD_THRESHOLD).toBe(0.55);
  });

  it('getTier returns 1 at zoom >= 0.55', async () => {
    const { getTier } = await import('../src/scene/lod');
    expect(getTier(1.0)).toBe(1);
    expect(getTier(0.55)).toBe(1);
    expect(getTier(0.56)).toBe(1);
  });

  it('getTier returns 2 at zoom < 0.55', async () => {
    const { getTier } = await import('../src/scene/lod');
    expect(getTier(0.54)).toBe(2);
    expect(getTier(0.18)).toBe(2);
  });
});

describe('Stagger queue', () => {
  it('processes one entry per tick call', () => {
    const reg = new TextureRegistry();
    const makeEntry = (priority: boolean) => {
      const ctx = { fillStyle: '', fillRect: vi.fn() };
      const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const draw = vi.fn();
      const tex = { needsUpdate: false, image: cv, dispose: vi.fn() } as any;
      reg.register(cv, draw, 512, 512, [tex], priority);
      return { draw, tex };
    };

    const e1 = makeEntry(true);
    const e2 = makeEntry(true);
    makeEntry(false);

    // Build queue for tier 2 (only priority=true)
    const queue = reg.buildQueue(2).slice(); // copy

    // Process first entry
    reg.applyScale(queue[0], 2);
    expect(e1.draw).toHaveBeenCalledTimes(1);
    expect(e2.draw).toHaveBeenCalledTimes(0);

    // Process second entry
    reg.applyScale(queue[1], 2);
    expect(e2.draw).toHaveBeenCalledTimes(1);
  });

  it('non-priority entries stay at 1x when tier switches to 2', () => {
    const reg = new TextureRegistry();
    const ctx = { fillStyle: '', fillRect: vi.fn() };
    const cv = { width: 512, height: 512, getContext: () => ctx } as unknown as HTMLCanvasElement;
    const draw = vi.fn();
    const tex = { needsUpdate: false, image: cv, dispose: vi.fn() } as any;
    reg.register(cv, draw, 512, 512, [tex], false); // not priority

    const queue = reg.buildQueue(2); // tier 2 but not priority
    expect(queue).toHaveLength(0);
  });
});
