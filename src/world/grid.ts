export interface Pt { x: number; y: number }
export interface Grid {
  cols: number; rows: number;
  walk: boolean[];           // index y*cols+x
  hotspots: Map<number, Pt>; // hotspot id -> tile
  spawn: Pt;
}

export function parseLayout(rows: string[]): Grid {
  const h = rows.length, w = rows[0].length;
  const walk = new Array<boolean>(w * h).fill(false);
  const hotspots = new Map<number, Pt>();
  let spawn: Pt | null = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === undefined || ch === '#') continue;
      walk[y * w + x] = true;
      if (ch === 'S') spawn = { x, y };
      else if (ch >= '1' && ch <= '8') hotspots.set(Number(ch), { x, y });
    }
  }
  if (!spawn) throw new Error('layout has no spawn S');
  return { cols: w, rows: h, walk, hotspots, spawn };
}

export function isWalkable(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.cols && y < g.rows && g.walk[y * g.cols + x];
}

export function hotspotAt(g: Grid, x: number, y: number): number | undefined {
  for (const [id, p] of g.hotspots) if (p.x === x && p.y === y) return id;
  return undefined;
}
