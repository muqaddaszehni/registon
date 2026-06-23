import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';
import { advance } from './walker';
import { Grid, Pt } from '../world/grid';
import { findPath } from './astar';
import { tileToWorld, worldToTile, V2 } from '../world/coords';

const SPEED = 3.2; // tiles per second

// Jewel-tone robe palette — warm Silk-Road traveller, reads against the pale plaza.
// Drawn from palette C where it fits; two robe tones are character-specific.
const ROBE = 0x4a6db5;        // deep cornflower / indigo-blue robe (cool jewel tone)
const ROBE_HEM = C.lapis;     // dark lapis hem band at the skirt base
const SASH = C.gold;          // gold sash
const TURBAN = C.cream;       // cream turban
const TURBAN_BAND = C.terracotta; // terracotta twist over the turban
const SKIN = 0xd9a878;        // warm tan face

export class Character {
  group = new THREE.Group();
  onArrive: (() => void) | null = null;
  private pos: V2;
  private waypoints: V2[] = [];
  private heading = 0;
  // Inner pivot: holds the whole figure so we can apply walk-bob + idle-sway
  // without disturbing group.position (which the public worldPos logic owns).
  private body = new THREE.Group();
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private grid: Grid) {
    this.group.name = 'hero';

    // ── ROBE (tapered skirt) ────────────────────────────────────────
    // A lathe-turned conical robe that flares at the hem: narrow shoulders,
    // wide sweeping skirt. Profile points are (radius, height) bottom→top.
    const robeProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.34, 0.00),  // wide hem
      new THREE.Vector2(0.33, 0.10),
      new THREE.Vector2(0.27, 0.32),
      new THREE.Vector2(0.22, 0.58),
      new THREE.Vector2(0.19, 0.80),  // waist/chest
      new THREE.Vector2(0.17, 0.92),  // shoulders
      new THREE.Vector2(0.12, 0.98),  // collar
    ];
    const robe = new THREE.Mesh(
      new THREE.LatheGeometry(robeProfile, 14),
      mat(ROBE),
    );
    this.body.add(robe);

    // Shoulder shawl — a low cream cape draped over the shoulders that bridges the
    // neck to the robe collar and adds an elegant Silk-Road layer. Lathe cone,
    // slightly proud of the robe shoulders.
    const shawlProfile: THREE.Vector2[] = [
      new THREE.Vector2(0.24, 0.78),
      new THREE.Vector2(0.21, 0.90),
      new THREE.Vector2(0.15, 1.00),
      new THREE.Vector2(0.105, 1.05),
    ];
    const shawl = new THREE.Mesh(new THREE.LatheGeometry(shawlProfile, 14), mat(TURBAN));
    this.body.add(shawl);

    // Hem band — a darker ring at the very bottom of the skirt for weight.
    const hem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.345, 0.345, 0.10, 12, 1, true),
      mat(ROBE_HEM),
    );
    hem.position.y = 0.05;
    this.body.add(hem);

    // ── GOLD SASH ───────────────────────────────────────────────────
    // A thin tilted band at the waist — catches the light, breaks the robe.
    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.225, 0.085, 12, 1, true),
      mat(SASH),
    );
    sash.position.y = 0.66;
    this.body.add(sash);
    // Sash knot — a small node on the front (+Z) so the figure has a front.
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(SASH));
    knot.position.set(0, 0.63, 0.2);
    this.body.add(knot);

    // ── HEAD ────────────────────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(SKIN));
    head.position.y = 1.13;
    this.body.add(head);

    // ── TURBAN ──────────────────────────────────────────────────────
    // Squashed ivory sphere wrapping the crown, with a terracotta twist-band
    // and a small front fold so heading is legible.
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8), mat(TURBAN));
    turban.scale.set(1, 0.72, 1);
    turban.position.y = 1.27;
    this.body.add(turban);
    const turbanBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.175, 0.035, 6, 14),
      mat(TURBAN_BAND),
    );
    turbanBand.rotation.x = Math.PI / 2;
    turbanBand.position.y = 1.235;
    this.body.add(turbanBand);

    // ── FRONT INDICATOR (heading) ───────────────────────────────────
    // A small terracotta fold on the front of the turban + a tiny tan nose,
    // both on +Z, so the facing direction is clear at scene scale.
    const fold = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(TURBAN_BAND));
    fold.position.set(0, 1.30, 0.155);
    this.body.add(fold);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(SKIN));
    nose.position.set(0, 1.12, 0.16);
    this.body.add(nose);

    this.group.add(this.body);
    this.group.scale.setScalar(1.5);
    shadowed(this.group);
    this.pos = tileToWorld(grid.cols, grid.rows, grid.spawn);
    this.group.position.set(this.pos.x, 0, this.pos.z);
  }

  get worldPos(): V2 { return { ...this.pos }; }

  /** True while walking a path (used to drive on-demand shadow-map updates). */
  get moving(): boolean { return this.waypoints.length > 0; }

  /** Halt the current walk in place (e.g. when a double-tap zoom interrupts). */
  stop(): void { this.waypoints = []; }

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
      // Walk: gentle forward-back lean in sync with the bob; no idle sway.
      this.body.rotation.z = 0;
      this.body.rotation.x = this.reduced ? 0 : Math.sin(t * 10) * 0.05;
      if (r.waypoints.length) {
        const n = r.waypoints[0];
        this.heading = Math.atan2(n.x - this.pos.x, n.z - this.pos.z);
      }
      this.group.rotation.y = this.heading;
      if (!this.waypoints.length) {
        this.group.position.y = 0;
        this.body.rotation.x = 0;
        this.onArrive?.();
      }
    } else if (!this.reduced) {
      // Idle: a slow, tiny sway — a breathing traveller at rest.
      const t = performance.now() / 1000;
      this.body.rotation.z = Math.sin(t * 1.1) * 0.025;
      this.body.rotation.x = 0;
    }
  }
}
