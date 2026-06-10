import * as THREE from 'three';
import { C } from '../palette';
import { mat } from '../buildings/primitives';
import { Grid, isWalkable } from '../world/grid';
import { tileToWorld, V2 } from '../world/coords';

interface Dove { g: THREE.Group; pos: V2; target: V2; fly: number; phase: number }

export function addDoves(scene: THREE.Scene, grid: Grid, heroPos: () => V2): (dt: number) => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const home = tileToWorld(grid.cols, grid.rows, grid.hotspots.get(8)!);
  const doves: Dove[] = [];

  const spot = (i: number): V2 => {
    for (let r = 2 + (i % 3); r < 9; r++) {
      const a = i * 2.39996 + r;
      const x = Math.round(home.x + Math.cos(a) * r + grid.cols / 2 - 0.5);
      const y = Math.round(home.z + Math.sin(a) * r + grid.rows / 2 - 0.5);
      if (isWalkable(grid, x, y)) return tileToWorld(grid.cols, grid.rows, { x, y });
    }
    return home;
  };

  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(C.dove));
    body.scale.set(1.4, 1, 1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat(C.dove));
    head.position.set(0.16, 0.08, 0);
    g.add(body, head);
    const p = spot(i);
    g.position.set(p.x, 0.1, p.z);
    scene.add(g);
    doves.push({ g, pos: { ...p }, target: spot(i + 7), fly: 0, phase: i });
  }

  return (dt: number) => {
    const hp = heroPos();
    for (const d of doves) {
      const dist = Math.hypot(d.pos.x - hp.x, d.pos.z - hp.z);
      if (dist < 1.6 && d.fly <= 0) { d.fly = reduced ? 0 : 1.4; d.target = spot(d.phase + Math.floor(d.pos.x * 7)); }
      const speed = d.fly > 0 ? 5 : 0.5;
      const dx = d.target.x - d.pos.x, dz = d.target.z - d.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.05) {
        d.pos.x += (dx / dd) * speed * dt;
        d.pos.z += (dz / dd) * speed * dt;
        d.g.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      } else if (dist < 1.6 && reduced) {
        d.target = spot(d.phase + Math.floor(hp.x * 3));
      }
      d.fly = Math.max(0, d.fly - dt);
      const h = d.fly > 0 ? Math.sin((1.4 - d.fly) / 1.4 * Math.PI) * 2.2 : 0;
      d.g.position.set(d.pos.x, 0.1 + h, d.pos.z);
    }
  };
}
