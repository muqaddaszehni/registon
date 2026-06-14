import * as THREE from 'three';
import { C } from '../palette';
import { mat } from '../buildings/primitives';
import { Grid, isWalkable } from '../world/grid';
import { tileToWorld, V2 } from '../world/coords';

// ---------------------------------------------------------------------------
// Wheeling pigeon flock — 13 birds circling above the plaza.
// Each bird follows a deterministic elliptical orbit parameterised by golden-angle
// offsets (no Math.random). Altitude ~5-9 units above ground.
//
// Golden angle: 2.39996 rad ≈ 137.5° — gives maximally-spread phase distribution.
// prefers-reduced-motion: flock frozen in place (t stays 0).
// ---------------------------------------------------------------------------

const FLOCK_COUNT = 13;
const GOLDEN = 2.39996; // golden angle (radians)

// Flock orbit: centred near mid-plaza, slight north bias
const ORBIT_CX = 0;
const ORBIT_CZ = -1.0;
const ORBIT_RX  = 5.5;  // east-west radius
const ORBIT_RZ  = 3.8;  // north-south radius (flatter = more realistic soaring)
const ORBIT_SPEED = 0.18; // radians/sec, slow and languid

function makePigeon(i: number): THREE.Group {
  const g = new THREE.Group();
  // Small compact body — slightly larger than ground doves
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 7, 5),
    mat(i % 3 === 0 ? 0xd8d0c0 : (i % 3 === 1 ? 0xa89880 : 0xc8bca8)),
  );
  body.scale.set(1.5, 0.85, 1.0);
  g.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 5, 4),
    mat(i % 2 === 0 ? 0x706050 : 0x908070),
  );
  head.position.set(0.13, 0.05, 0);
  g.add(head);

  // Wings — flat thin boxes angled out like soaring wings
  for (const side of [-1, 1] as const) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.02, 0.10),
      mat(0xb0a090),
    );
    wing.position.set(0, 0, side * 0.18);
    wing.rotation.x = side * 0.25; // slight dihedral
    g.add(wing);
  }

  return g;
}

interface FlockBird {
  g: THREE.Group;
  phaseOffset: number; // initial angle on orbit
  altOffset: number;   // vertical drift offset
  orbitScale: number;  // minor per-bird orbit scale variation
}

// ---------------------------------------------------------------------------
// Ground doves (original logic preserved, unchanged)
// ---------------------------------------------------------------------------

interface Dove2 { g: THREE.Group; pos: V2; target: V2; fly: number; phase: number }

export function addDoves(scene: THREE.Scene, grid: Grid, heroPos: () => V2): (dt: number) => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const home = tileToWorld(grid.cols, grid.rows, grid.hotspots.get(8)!);

  // ── Ground dove scatter positions ───────────────────────────────────────
  const spot = (i: number): V2 => {
    for (let r = 2 + (i % 3); r < 9; r++) {
      const a = i * 2.39996 + r;
      const x = Math.round(home.x + Math.cos(a) * r + grid.cols / 2 - 0.5);
      const y = Math.round(home.z + Math.sin(a) * r + grid.rows / 2 - 0.5);
      if (isWalkable(grid, x, y)) return tileToWorld(grid.cols, grid.rows, { x, y });
    }
    return home;
  };

  const doves: Dove2[] = [];
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

  // ── Wheeling pigeon flock ───────────────────────────────────────────────
  const flock: FlockBird[] = [];
  for (let i = 0; i < FLOCK_COUNT; i++) {
    const g = makePigeon(i);
    // Spread birds evenly around orbit using golden angle
    const phaseOffset = i * GOLDEN;
    // Slight orbit size variation per bird (deterministic, no random)
    const orbitScale  = 0.88 + (i % 5) * 0.06; // 0.88 .. 1.12
    // Altitude variation: base 6.0, offset by up to ±1.5
    const altOffset   = 6.0 + (i % 7 - 3) * 0.45;

    // Start position
    const angle = phaseOffset;
    g.position.set(
      ORBIT_CX + Math.cos(angle) * ORBIT_RX * orbitScale,
      altOffset,
      ORBIT_CZ + Math.sin(angle) * ORBIT_RZ * orbitScale,
    );
    scene.add(g);
    flock.push({ g, phaseOffset, altOffset, orbitScale });
  }

  // ── Tick ────────────────────────────────────────────────────────────────
  let t = 0;
  return (dt: number) => {
    // Ground doves
    const hp = heroPos();
    for (const d of doves) {
      const dist = Math.hypot(d.pos.x - hp.x, d.pos.z - hp.z);
      if (dist < 1.6 && d.fly <= 0) {
        d.fly = reduced ? 0 : 1.4;
        d.target = spot(d.phase + Math.floor(d.pos.x * 7));
      }
      const speed = d.fly > 0 ? 5 : 0.5;
      const dx = d.target.x - d.pos.x, dz = d.target.z - d.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > 0.05) {
        d.pos.x += (dx / dd) * speed * dt;
        d.pos.z += (dz / dd) * speed * dt;
        d.g.rotation.y = Math.atan2(-dz, dx);
      } else if (dist < 1.6 && reduced) {
        d.target = spot(d.phase + Math.floor(hp.x * 3));
      }
      d.fly = Math.max(0, d.fly - dt);
      const h = d.fly > 0 ? Math.sin((1.4 - d.fly) / 1.4 * Math.PI) * 2.2 : 0;
      d.g.position.set(d.pos.x, 0.1 + h, d.pos.z);
    }

    // Wheeling flock — freeze if reduced-motion
    if (reduced) return;
    t += dt;

    for (let i = 0; i < FLOCK_COUNT; i++) {
      const bird = flock[i];
      const angle = t * ORBIT_SPEED + bird.phaseOffset;
      const ox = ORBIT_CX + Math.cos(angle) * ORBIT_RX * bird.orbitScale;
      const oz = ORBIT_CZ + Math.sin(angle) * ORBIT_RZ * bird.orbitScale;
      // Gentle altitude bob (deterministic sine per bird)
      const oy = bird.altOffset + Math.sin(t * 0.7 + bird.phaseOffset) * 0.4;

      bird.g.position.set(ox, oy, oz);

      // Face along tangent direction
      const tangentX = -Math.sin(angle) * ORBIT_RX;
      const tangentZ =  Math.cos(angle) * ORBIT_RZ;
      bird.g.rotation.y = Math.atan2(-tangentZ, tangentX);

      // Gentle wing-flap tilt: bank into turn
      bird.g.rotation.z = Math.sin(t * 1.8 + bird.phaseOffset * 2.1) * 0.15;
    }
  };
}
