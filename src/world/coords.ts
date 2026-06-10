import type { Pt } from './grid';
export interface V2 { x: number; z: number }
export const TILE = 1;

export function tileToWorld(cols: number, rows: number, t: Pt): V2 {
  return { x: (t.x - cols / 2 + 0.5) * TILE, z: (t.y - rows / 2 + 0.5) * TILE };
}
export function worldToTile(cols: number, rows: number, w: V2): Pt {
  return { x: Math.round(w.x / TILE + cols / 2 - 0.5), y: Math.round(w.z / TILE + rows / 2 - 0.5) };
}
