import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// ---------------------------------------------------------------------------
// Plaza life: human silhouettes, market stalls, standing lanterns,
// prayer rugs, and a small central fountain channel.
//
// All positions are on '#' (blocked) tiles or at the open plaza perimeter,
// safely clear of the central walkable corridor (cols 11-16, rows 5-18 approx).
//
// Determinism: no Math.random — all layout is from lookup tables + golden-angle.
// prefers-reduced-motion: human drift motion freezes (statics unaffected).
// Lambert materials throughout (no Phong, no reflective).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. HUMAN SILHOUETTES
// robed cone+sphere (same motif as hero character) at plaza edges/near portals.
// Colors: muted earthy tones per Timurid palette.
// ---------------------------------------------------------------------------

const ROBE_COLORS = [
  0x9a5c3a, // burnt sienna
  0x4a6a8a, // muted cobalt
  0x6a7a4a, // olive green
  0x8a6a3a, // ochre
  0x5a4a6a, // dusty purple
  0x7a4a4a, // terracotta muted
  0xc4a86a, // warm sand
];

// [worldX, worldZ, robeColorIdx, headSize, driftDX, driftDZ]
// driftDX/driftDZ: slow deterministic walk direction (zeroed = static)
// All positions are on plaza perimeter or near blocked-tile areas.
const PERSON_DEFS: [number, number, number, number, number, number][] = [
  // Near Ulugh Beg portal (north side, cols 6-8, rows 3-4 — blocked/edge)
  [-7.5, -6.5,  0, 0.19,  0.0,  0.0],  // standing figure near NW
  [-5.5, -6.5,  1, 0.17,  0.0,  0.0],  // second figure next to them

  // Near Sher-Dor portal (east side)
  [ 8.5, -4.5,  2, 0.20,  0.0,  0.0],  // NE quadrant
  [ 9.5, -2.5,  3, 0.18,  0.0,  0.0],

  // Near Tilya-Kori (south-ish mid-plaza)
  [ 1.5,  6.5,  4, 0.17,  0.0,  0.0],  // near south, not on spawn corridor
  [-2.5,  6.5,  5, 0.19,  0.0,  0.0],

  // West colonnade edge — on the open plaza (not behind the building)
  [-8.5,  -0.5, 6, 0.16,  0.0,  0.0],  // standing near west stalls
  [-8.5,   2.5, 0, 0.18,  0.0,  0.0],

  // East colonnade edge
  [ 7.5,   1.5,  1, 0.20,  0.0,  0.0],
  [ 7.5,   4.5,  3, 0.17,  0.0,  0.0],
];

// Slow strollers — these drift back and forth deterministically
// [worldX, worldZ, colorIdx, maxOffset, axisX, axisZ]
const STROLLER_DEFS: [number, number, number, number, number, number][] = [
  [-7.5,  -2.5,  2, 1.5,  1.0,  0.0],  // walks east-west on west side
  [ 7.0,   3.5,  5, 1.2,  0.0,  1.0],  // walks north-south on east side
  [-4.5,   5.5,  6, 1.2,  1.0,  0.0],  // near SW garden
];

function makePerson(colorIdx: number, headR: number): THREE.Group {
  const g = new THREE.Group();
  const robeColor = ROBE_COLORS[colorIdx % ROBE_COLORS.length];

  // Robe: tapered cone (wider base)
  const robe = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.9, 7),
    mat(robeColor),
  );
  robe.position.y = 0.45;
  g.add(robe);

  // Head: sphere (slightly different tone)
  const headColor = 0xd4b89a; // warm skin tone
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(headR, 7, 6),
    mat(headColor),
  );
  head.position.y = 0.9 + headR;
  g.add(head);

  // Head covering / turban suggestion: small flat cylinder
  const turbanColor = ROBE_COLORS[(colorIdx + 2) % ROBE_COLORS.length];
  const turban = new THREE.Mesh(
    new THREE.CylinderGeometry(headR * 0.9, headR * 0.7, headR * 0.5, 8),
    mat(turbanColor),
  );
  turban.position.y = 0.9 + headR * 1.5;
  g.add(turban);

  return g;
}

// ---------------------------------------------------------------------------
// 2. MARKET STALLS
// Simple awning boxes: flat roof + two side supports, perimeter tiles only.
// ---------------------------------------------------------------------------

// [worldX, worldZ, awningColor, facingAngle_deg]
// Stalls sit just inside the arcade wall line (UB front face ≈ x=-11; SD front ≈ x=+10.5)
// Place them at x≈-9.5 / +9.0 so they clear the wall depth and appear on the plaza side.
const STALL_DEFS: [number, number, number, number][] = [
  // West row — tucked against the west arcade interior face
  [-9.5,  -2.5,  0xc04a2a,   0],  // red awning facing plaza (south)
  [-9.5,   0.5,  0x1e5fa8,   0],  // cobalt awning
  [-9.5,   3.5,  0xd9b545,   0],  // gold awning

  // East row — tucked against the east side interior
  [ 8.5,  -2.5,  0x2e8040, 180], // green facing plaza
  [ 8.5,   2.5,  0xc04a2a, 180],
];

function makeStall(awningColor: number, facingAngleDeg: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.4, d = 0.9;

  // Awning roof — thin flat box, tilted slightly forward
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    mat(awningColor),
  );
  awning.position.y = 1.6;
  awning.rotation.x = -0.12; // slight forward tilt
  g.add(awning);

  // Front drop flap (thin vertical plane)
  const flap = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.35, 0.04),
    mat(awningColor),
  );
  flap.position.set(0, 1.42, d / 2 - 0.02);
  g.add(flap);

  // Two support posts
  for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 1.6, 6),
      mat(C.trunk),
    );
    post.position.set(sx, 0.8, d / 2 - 0.1);
    g.add(post);
  }

  // Counter/table slab
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.1, 0.08, d * 0.65),
    mat(C.sandLight),
  );
  counter.position.set(0, 0.9, 0);
  g.add(counter);

  // A couple of "goods" — small boxes on the counter
  for (let i = 0; i < 3; i++) {
    const boxW = 0.18 + (i % 2) * 0.06;
    const boxH = 0.12 + (i % 3) * 0.06;
    const good = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, 0.14),
      mat(i % 2 === 0 ? C.terracotta : C.gold),
    );
    good.position.set(-0.4 + i * 0.38, 0.97 + boxH / 2, 0);
    g.add(good);
  }

  g.rotation.y = (facingAngleDeg * Math.PI) / 180;
  return g;
}

// ---------------------------------------------------------------------------
// 3. STANDING LANTERNS
// Tall slim pole with a hexagonal lantern head. Warm amber light (visual only).
// ---------------------------------------------------------------------------

// [worldX, worldZ]
const LANTERN_DEFS: [number, number][] = [
  // Entrance to plaza (near south rows 16-18)
  [-3.5,  7.5],
  [ 3.5,  7.5],
  // Flanking the central axis at mid-plaza
  [-2.5,  0.5],
  [ 2.5,  0.5],
  // Near portals
  [-9.5, -5.5],
  [ 8.5, -5.5],
];

function makeLantern(): THREE.Group {
  const g = new THREE.Group();

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.055, 2.2, 6),
    mat(0x4a3a2a), // dark bronze
  );
  pole.position.y = 1.1;
  g.add(pole);

  // Base flange
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.08, 8),
    mat(0x5a4a3a),
  );
  base.position.y = 0.04;
  g.add(base);

  // Lantern body — hexagonal prism
  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.16, 0.28, 6),
    mat(0xd9b545), // gold/amber
  );
  lanternBody.position.y = 2.34;
  g.add(lanternBody);

  // Lantern cap — small cone roof
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.20, 0.18, 6),
    mat(0x4a3a2a),
  );
  cap.position.y = 2.56;
  g.add(cap);

  // Finial tip
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 5, 4),
    mat(C.gold),
  );
  finial.position.y = 2.67;
  g.add(finial);

  return g;
}

// ---------------------------------------------------------------------------
// 4. PRAYER RUGS / CARPETS
// Flat patterned quads near the mosque (Tilya-Kori) side — south area.
// Simple flat boxes with a warm patterned colour, striped via vertex colours.
// ---------------------------------------------------------------------------

// [worldX, worldZ, rugColor, rotationY]
const RUG_DEFS: [number, number, number, number][] = [
  // Near south entrance, east of spawn corridor
  [ 4.5,  5.5,  0xa03830,   0.0],
  [ 6.5,  5.5,  0x2a5a8a,   0.1],
  // Near west side
  [-5.5,  5.5,  0xb04820,  -0.1],
  // Near north portals
  [-6.5, -3.5,  0x8a3838,   0.3],
  [ 6.5, -3.5,  0x2a408a,  -0.2],
];

function makeRug(rugColor: number): THREE.Group {
  const g = new THREE.Group();

  // Main rug body — flat box
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.025, 1.40),
    mat(rugColor),
  );
  rug.position.y = 0.013;
  g.add(rug);

  // Border stripe — slightly lighter, 4 thin strips
  const borderColor = (rugColor & 0xfefefe) + 0x303030; // lighten
  for (const [bx, bz, bw, bd] of [
    [0.0, -0.65, 0.95, 0.06] as [number,number,number,number],
    [0.0,  0.65, 0.95, 0.06] as [number,number,number,number],
    [-0.42, 0.0, 0.06, 1.28] as [number,number,number,number],
    [ 0.42, 0.0, 0.06, 1.28] as [number,number,number,number],
  ]) {
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(bw, 0.028, bd),
      mat(borderColor),
    );
    border.position.set(bx, 0.02, bz);
    g.add(border);
  }

  // Central medallion suggestion — small raised diamond
  const medalColor = C.gold;
  const medal = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.032, 0.28),
    mat(medalColor),
  );
  medal.position.y = 0.025;
  medal.rotation.y = Math.PI / 4;
  g.add(medal);

  return g;
}

// ---------------------------------------------------------------------------
// 5. SMALL FOUNTAIN / REFLECTING CHANNEL
// A shallow octagonal pool near the centre-south of the plaza.
// Position: world (0, 4.5) — clear of spawn corridor (spawn=col13,row19 → world -0.5,8.5)
// and hotspot 7 (row14,col13 → world -0.5,3.5).  We place it at (0,4.5) — between hs8 and hs7.
// Actually avoid hotspot positions. hs7 = row14 → world z = 14-11+0.5 = 3.5; hs8 = row12 → z=1.5.
// Place fountain at z=4.5 (row15) — that row has '.' so walkable.
// Move slightly off-axis to col 14 → x=0.5. Fountain is small (r=0.6) so won't block path.
// ---------------------------------------------------------------------------

function makeFountain(): THREE.Group {
  const g = new THREE.Group();

  // Shallow octagonal basin
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.68, 0.14, 8),
    mat(C.marble),
  );
  basin.position.y = 0.07;
  g.add(basin);

  // Inner water surface (slightly lower, teal)
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.60, 0.60, 0.02, 8),
    mat(0x5ec8c0), // light teal water
  );
  water.position.y = 0.12;
  g.add(water);

  // Central column / jet stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.06, 0.55, 7),
    mat(C.marble),
  );
  stem.position.y = 0.22;
  g.add(stem);

  // Spout cap
  const spout = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 5),
    mat(0x5ec8c0),
  );
  spout.position.y = 0.73;
  g.add(spout);

  // Droplet suggestion: 4 tiny spheres arcing outward (frozen geometry)
  for (let i = 0; i < 4; i++) {
    const angle = i * (Math.PI / 2);
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 5, 4),
      mat(0x80ddd8),
    );
    drop.position.set(
      Math.cos(angle) * 0.18,
      0.65,
      Math.sin(angle) * 0.18,
    );
    g.add(drop);
  }

  return g;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function addLife(scene: THREE.Scene): (dt: number) => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Static standing people ──
  const staticPeople: THREE.Group[] = [];
  for (let i = 0; i < PERSON_DEFS.length; i++) {
    const [x, z, colorIdx, headR] = PERSON_DEFS[i];
    const p = makePerson(colorIdx, headR);
    // Slight deterministic facing variety
    p.rotation.y = i * 1.1;
    p.position.set(x, 0, z);
    scene.add(shadowed(p));
    staticPeople.push(p);
  }

  // ── Slow strollers ──
  interface StrollerState {
    g: THREE.Group;
    baseX: number;
    baseZ: number;
    maxOff: number;
    axisX: number;
    axisZ: number;
    phase: number;
  }
  const strollers: StrollerState[] = [];
  for (let i = 0; i < STROLLER_DEFS.length; i++) {
    const [x, z, colorIdx, maxOff, axisX, axisZ] = STROLLER_DEFS[i];
    const p = makePerson(colorIdx, 0.18);
    p.position.set(x, 0, z);
    scene.add(shadowed(p));
    strollers.push({
      g: p,
      baseX: x,
      baseZ: z,
      maxOff: maxOff,
      axisX: axisX,
      axisZ: axisZ,
      phase: i * 2.1,
    });
  }

  // ── Market stalls ──
  for (const [x, z, color, angle] of STALL_DEFS) {
    const stall = makeStall(color, angle);
    stall.position.set(x, 0, z);
    scene.add(shadowed(stall));
  }

  // ── Lanterns ──
  for (const [x, z] of LANTERN_DEFS) {
    const lantern = makeLantern();
    lantern.position.set(x, 0, z);
    scene.add(shadowed(lantern));
  }

  // ── Prayer rugs ──
  for (const [x, z, color, ry] of RUG_DEFS) {
    const rug = makeRug(color);
    rug.position.set(x, 0, z);
    rug.rotation.y = ry;
    scene.add(rug); // rugs don't cast meaningful shadows
  }

  // ── Fountain ──
  const fountain = makeFountain();
  fountain.position.set(0.5, 0, 4.5);
  scene.add(shadowed(fountain));

  // ── Tick — stroller drift only ──
  let t = 0;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    for (const s of strollers) {
      const offset = Math.sin(t * 0.25 + s.phase) * s.maxOff;
      s.g.position.set(
        s.baseX + s.axisX * offset,
        0,
        s.baseZ + s.axisZ * offset,
      );
      // Face direction of movement
      const vel = Math.cos(t * 0.25 + s.phase);
      if (Math.abs(vel) > 0.05) {
        s.g.rotation.y = s.axisX !== 0
          ? (vel > 0 ? 0 : Math.PI)
          : (vel > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    }
  };
}
