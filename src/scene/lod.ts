import * as THREE from 'three';

export const LOD_THRESHOLD = 0.55;

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface LodEntry {
  canvas: HTMLCanvasElement;
  draw: DrawFn;
  baseW: number;
  baseH: number;
  textures: THREE.CanvasTexture[];
  /** High-priority entries get 2x; low-priority stay 1x */
  priority: boolean;
}

export function getTier(zoom: number): 1 | 2 {
  return zoom < LOD_THRESHOLD ? 2 : 1;
}

export class TextureRegistry {
  readonly entries: LodEntry[] = [];

  register(
    cv: HTMLCanvasElement,
    draw: DrawFn,
    baseW: number,
    baseH: number,
    textures: THREE.CanvasTexture[],
    priority = true,
  ): void {
    this.entries.push({ canvas: cv, draw, baseW, baseH, textures, priority });
  }

  /** Attach an additional texture (clone) that shares the same canvas. */
  addTexture(cv: HTMLCanvasElement, tex: THREE.CanvasTexture): void {
    const entry = this.entries.find(e => e.canvas === cv);
    if (entry) entry.textures.push(tex);
  }

  /** Build the re-rasterization queue for a given tier. Priority entries first. */
  buildQueue(tier: 1 | 2): LodEntry[] {
    // Only include priority entries when tier is 2; at tier 1 all entries
    const relevant = tier === 2
      ? this.entries.filter(e => e.priority)
      : this.entries;
    return [
      ...relevant.filter(e => e.priority),
      ...relevant.filter(e => !e.priority),
    ];
  }

  /** Resize canvas and redraw at scale, then force full GPU re-upload.
   *
   * When canvas dimensions change, Three.js would try glTexSubImage2D which
   * errors if the new size is larger than the existing GPU allocation.
   * Calling dispose() first removes the GPU texture so the next render
   * triggers glTexImage2D (full re-allocation) instead.
   */
  applyScale(entry: LodEntry, scale: 1 | 2): void {
    const newW = entry.baseW * scale;
    const newH = entry.baseH * scale;
    entry.canvas.width  = newW;
    entry.canvas.height = newH;
    const ctx = entry.canvas.getContext('2d')!;
    entry.draw(ctx, newW, newH);
    for (const tex of entry.textures) {
      // dispose() removes the GPU allocation; needsUpdate then forces full re-upload
      tex.dispose();
      tex.needsUpdate = true;
    }
  }
}

/** Singleton — one registry per app session. */
export const textureRegistry = new TextureRegistry();

/**
 * LodManager: wires tier-change callbacks to the TextureRegistry stagger queue.
 * Call lodManager.tick() once per animation frame.
 */
export class LodManager {
  private queue: LodEntry[] = [];
  private currentTier: 1 | 2 = 1;
  private enabled = true;

  constructor(private registry: TextureRegistry) {}

  /** Disable on low-end devices (capability gate). */
  disable(): void { this.enabled = false; }

  /** Called by ZoomController.onTierChange */
  onTierChange(tier: 1 | 2): void {
    if (!this.enabled) return;
    this.currentTier = tier;
    // Build stagger queue: one entry per frame will be processed
    this.queue = this.registry.buildQueue(tier).slice();
  }

  /** Called each animation frame. Processes one canvas from the queue. */
  tick(): void {
    if (this.queue.length === 0) return;
    const entry = this.queue.shift()!;
    this.registry.applyScale(entry, this.currentTier);
  }
}

export const lodManager = new LodManager(textureRegistry);
