import type { V2 } from '../world/coords';

export function advance(pos: V2, waypoints: V2[], dist: number): { pos: V2; waypoints: V2[] } {
  let p = { ...pos };
  let wp = waypoints.slice();
  while (dist > 0 && wp.length) {
    const t = wp[0];
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d <= dist) { p = { ...t }; wp.shift(); dist -= d; }
    else { p = { x: p.x + (dx / d) * dist, z: p.z + (dz / d) * dist }; dist = 0; }
  }
  return { pos: p, waypoints: wp };
}
