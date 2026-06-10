import { Grid, Pt, isWalkable } from '../world/grid';

export function findPath(g: Grid, start: Pt, goal: Pt): Pt[] | null {
  if (!isWalkable(g, start.x, start.y) || !isWalkable(g, goal.x, goal.y)) return null;
  const key = (p: Pt) => p.y * g.cols + p.x;
  const open: Pt[] = [start];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(start), 0]]);
  const h = (p: Pt) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const fa = gScore.get(key(open[i]))! + h(open[i]);
      const fb = gScore.get(key(open[bi]))! + h(open[bi]);
      if (fa < fb) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      const path: Pt[] = [cur];
      let k = key(cur);
      while (came.has(k)) {
        k = came.get(k)!;
        path.unshift({ x: k % g.cols, y: Math.floor(k / g.cols) });
      }
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (!isWalkable(g, n.x, n.y)) continue;
      const ng = gScore.get(key(cur))! + 1;
      if (ng < (gScore.get(key(n)) ?? Infinity)) {
        gScore.set(key(n), ng);
        came.set(key(n), key(cur));
        if (!open.some(p => p.x === n.x && p.y === n.y)) open.push(n);
      }
    }
  }
  return null;
}
