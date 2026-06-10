import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';
import { advance } from './walker';
import { Grid, Pt } from '../world/grid';
import { findPath } from './astar';
import { tileToWorld, worldToTile, V2 } from '../world/coords';

const SPEED = 3.2; // tiles per second

export class Character {
  group = new THREE.Group();
  onArrive: (() => void) | null = null;
  private pos: V2;
  private waypoints: V2[] = [];
  private heading = 0;

  constructor(private grid: Grid) {
    // Slimmer cone body (was r=0.32 → 0.24), same terracotta
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 10), mat(C.terracotta));
    body.position.y = 0.45;
    // Cream head (unchanged)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat(C.cream));
    head.position.y = 1.0;
    // Gold cap (unchanged)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 10), mat(C.gold));
    cap.position.y = 1.16;
    // Nose pointing outward (heading indicator)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(C.cream));
    nose.position.set(0, 1.0, 0.16);
    // Scarf band: thin torus where head meets body — cream accent
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.03, 6, 16),
      mat(C.cream),
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.84; // at neck — where sphere base meets cone tip
    this.group.add(body, head, cap, nose, scarf);
    this.group.scale.setScalar(1.5);
    shadowed(this.group);
    this.pos = tileToWorld(grid.cols, grid.rows, grid.spawn);
    this.group.position.set(this.pos.x, 0, this.pos.z);
  }

  get worldPos(): V2 { return { ...this.pos }; }

  get tile(): Pt { return worldToTile(this.grid.cols, this.grid.rows, this.pos); }

  walkTo(target: Pt): boolean {
    const path = findPath(this.grid, this.tile, target);
    if (!path) return false;
    this.waypoints = path.slice(1).map(p => tileToWorld(this.grid.cols, this.grid.rows, p));
    return true;
  }

  tick(dt: number) {
    const wasMoving = this.waypoints.length > 0;
    const r = advance(this.pos, this.waypoints, SPEED * dt);
    this.pos = r.pos; this.waypoints = r.waypoints;
    if (wasMoving) {
      const t = performance.now() / 1000;
      this.group.position.set(this.pos.x, Math.abs(Math.sin(t * 10)) * 0.06, this.pos.z);
      if (r.waypoints.length) {
        const n = r.waypoints[0];
        this.heading = Math.atan2(n.x - this.pos.x, n.z - this.pos.z);
      }
      this.group.rotation.y = this.heading;
      if (!this.waypoints.length) {
        this.group.position.y = 0;
        this.onArrive?.();
      }
    }
  }
}
