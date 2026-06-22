import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../palette';
import { archPanel, portalTexture, iwanTexture, ropeTexture, brickWall, drumBand, minaretShaft, girihTile, arcadeFacade, calligraphyBand, type PortalVariant } from '../patterns/textures';
import { textureRegistry } from '../scene/lod';

export const mat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const matMap = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

export function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = h / 2;
  return m;
}

/** Box whose +Z face carries a pattern texture; other faces plain. */
export function patternedBox(w: number, h: number, d: number, color: number, face: THREE.Texture): THREE.Mesh {
  const plain = mat(color);
  const mats = [plain, plain, plain, plain, matMap(face), plain]; // +x,-x,+y,-y,+z,-z
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.y = h / 2;
  return m;
}

/**
 * Box with per-face texture map.
 * facesMap keys: 'px'|'nx'|'py'|'ny'|'pz'|'nz'
 * Any face not listed gets a plain color material.
 * Texture repeat is computed from world-size / patternWorldSize so pattern scale
 * stays consistent: one bannai diamond ≈ 1.2 world units.
 */
export function patternedBoxMulti(
  w: number, h: number, d: number,
  color: number,
  facesMap: Partial<Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', THREE.Texture>>,
): THREE.Mesh {
  const plain = mat(color);
  // Helper: clone texture with correct repeat for this face's world dimensions.
  // Clones share the source canvas (.image reference is the same HTMLCanvasElement).
  // Register each clone with the registry so needsUpdate is set on tier changes.
  function faceTexRepeat(tex: THREE.Texture, worldW: number, worldH: number): THREE.Material {
    const t = tex.clone() as THREE.CanvasTexture;
    t.needsUpdate = true;
    // Non-tiling textures (ClampToEdge) keep their wrapping and stay repeat(1,1)
    if (tex.wrapS === THREE.ClampToEdgeWrapping) {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(1, 1);
    } else {
      const PATTERN_WORLD = 10.0; // one bannai tile = 10 world units (4 diamonds/tile → ~2.5 wu/diamond — large geometry like refs)
      // Clamp to at least 0.5 repeats so shallow faces don't show stretched blobs
      t.repeat.set(Math.max(0.5, worldW / PATTERN_WORLD), Math.max(0.5, worldH / PATTERN_WORLD));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    // Register clone so it gets needsUpdate=true on tier changes (clone shares source canvas)
    if (tex instanceof THREE.CanvasTexture && tex.image instanceof HTMLCanvasElement) {
      textureRegistry.addTexture(tex.image, t);
    }
    return new THREE.MeshLambertMaterial({ map: t });
  }
  const faceOrder: Array<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'> = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
  const faceDims: Record<string, [number, number]> = {
    px: [d, h], nx: [d, h], py: [w, d], ny: [w, d], pz: [w, h], nz: [w, h],
  };
  const mats = faceOrder.map(key => {
    const tex = facesMap[key];
    if (!tex) return plain;
    const [fw, fh] = faceDims[key];
    return faceTexRepeat(tex, fw, fh);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.y = h / 2;
  return m;
}

/**
 * Arch-screen geometry: rectangle with a pointed-arch hole, extruded.
 * Origin: centre-bottom of screen face, front face at z = 0.
 * aw = arch width, spring = spring height, apex = apex height, depth = extrusion.
 * The hole path uses the same bezier profile as the reference (Persian pointed arch).
 */
export function archScreenGeometry(
  w: number, h: number, aw: number, spring: number, apex: number, depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(-w / 2, h);
  shape.lineTo(w / 2, h);  shape.lineTo(w / 2, 0);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-aw / 2, 0);
  hole.lineTo(-aw / 2, spring);
  hole.bezierCurveTo(
    -aw / 2, spring + (apex - spring) * 0.55,
    -aw * 0.30, apex - (apex - spring) * 0.18, 0, apex);
  hole.bezierCurveTo(
    aw * 0.30, apex - (apex - spring) * 0.18,
    aw / 2, spring + (apex - spring) * 0.55, aw / 2, spring);
  hole.lineTo(aw / 2, 0);
  hole.closePath();
  shape.holes.push(hole);

  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

/**
 * Monumental portal with true arch hole (ExtrudeGeometry with bezier-arch hole),
 * rope columns, telescoping inner arch, and iwan interior texture.
 *
 * variant controls tympanum art and portal texture identity:
 *   'ulughbeg'  → girih star constellation tympanum
 *   'sherdor'   → full tiger + doe + human-faced sun tympanum
 *   'tilyakori' → gold rosette/arabesque tympanum
 *
 * wingH: height of the flanking lower wing segments (world units, in raised-group space).
 *   Side walls descend from the cornice base (y=h) to y=wingH, closing the gap between the
 *   tall portal block and the lower wing roofs.
 */
export function pishtaq(
  w: number, h: number, d: number,
  opts: { variant?: PortalVariant; wingH?: number } = {},
): THREE.Group {
  const g = new THREE.Group();
  const variant: PortalVariant = opts.variant ?? 'ulughbeg';
  const wingH = opts.wingH ?? 0;  // flanking wing roof height (raised-group local y)

  // Proportions matching reference: aw=0.55w, spring=0.42h, apex=0.74h
  const screenDepth = Math.max(0.5, d * 0.12); // thickness of screen slab
  const aw     = w * 0.55;
  const spring = h * 0.42;
  const apex   = h * 0.74;
  const iwanDepth = Math.min(d * 0.85, 4.5);
  const frontZ = d / 2;
  const backZ  = frontZ - iwanDepth;

  // ── PORTAL SCREEN (arch hole geometry) ─────────────────────────
  const frontTex = portalTexture(variant, w, h);
  const frontMat = new THREE.MeshLambertMaterial({ map: frontTex });
  const sideMat  = new THREE.MeshLambertMaterial({ color: C.cobalt });
  const screen = new THREE.Mesh(
    archScreenGeometry(w, h, aw, spring, apex, screenDepth),
    [frontMat, sideMat],
  );
  // Front face at frontZ; ExtrudeGeometry extrudes in +Z, so shift back
  screen.position.set(0, 0, frontZ - screenDepth);
  screen.renderOrder = 1;
  g.add(screen);

  // ── TELESCOPING INNER ARCH (40% into iwan) ──────────────────────
  // Smaller screen recessed ~40% into the iwan — stepped portal frames
  const iw = aw + 2.6 * (w / 22);   // scale inner width proportionally (ref: +2.6 on 22m portal)
  const ih = apex + 1.4 * (h / 30); // scale inner height
  const innerFrontTex = girihTile();
  innerFrontTex.repeat.set(Math.max(1, Math.round(iw * 0.7)), Math.max(1, Math.round(ih * 0.7)));
  const innerFrontMat = new THREE.MeshLambertMaterial({ map: innerFrontTex });
  const innerScreen = new THREE.Mesh(
    archScreenGeometry(iw, ih, aw * 0.84, spring * 0.92, apex * 0.90, screenDepth * 0.5),
    [innerFrontMat, sideMat],
  );
  innerScreen.position.set(0, 0, frontZ - screenDepth - iwanDepth * 0.42);
  g.add(innerScreen);

  // ── ROPE COLUMNS ──────────────────────────────────────────────────
  // Flanking columns at screen plane; scaled from ref 0.85/1.0 radius on 22m portal → ~0.3 on ours
  const colR    = w * 0.038;          // ~0.30 for w=8 (ref: 0.85/22 × our_w)
  const colH    = h + screenDepth;
  const colOffset = w / 2 + colR * 1.6;

  const ropeTex = ropeTexture();
  ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
  ropeTex.repeat.set(2, 9);
  const ropeMat = new THREE.MeshLambertMaterial({ map: ropeTex });
  // Turquoise dome-like knob material
  const knobMat = new THREE.MeshLambertMaterial({
    color: C.turquoise,
    emissive: new THREE.Color(C.turquoise),
    emissiveIntensity: 0.14,
  });
  const tipMat = new THREE.MeshLambertMaterial({ color: C.gold });

  for (const sgn of [-1, 1] as const) {
    // Shaft (tapered cylinder)
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(colR * 0.85, colR, colH, 20),
      ropeMat,
    );
    col.position.set(sgn * colOffset, colH / 2, frontZ - screenDepth / 2);
    g.add(col);

    // Turquoise knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(colR * 1.18, 20, 14), knobMat);
    knob.position.set(sgn * colOffset, colH + colR * 1.2, frontZ - screenDepth / 2);
    g.add(knob);

    // Gold tip cone
    const tip = new THREE.Mesh(new THREE.ConeGeometry(colR * 0.35, colR * 1.3, 12), tipMat);
    tip.position.set(sgn * colOffset, colH + colR * 2.8, frontZ - screenDepth / 2);
    g.add(tip);
  }

  // ── IWAN FLOOR ────────────────────────────────────────────────────
  // Recess depth = iwanDepth - screenDepth (behind the screen slab only).
  // Z center = frontZ - screenDepth/2 - iwanDepth/2.
  const recessDepth = iwanDepth - screenDepth;
  const recessZCenter = frontZ - screenDepth / 2 - iwanDepth / 2;
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(aw + 0.4, 0.12, recessDepth),
    mat(C.sandDark),
  );
  floorMesh.position.set(0, 0.06, recessZCenter);
  g.add(floorMesh);

  // ── IWAN SIDE WALLS ───────────────────────────────────────────────
  // Beige sandstone reveals — continuous from vault ceiling to floor.
  // DoubleSide: PlaneGeometry back-face would be culled when camera looks in from outside;
  // DoubleSide ensures the inner face renders regardless of camera orientation.
  const sideWallH = apex + 0.4;
  const sideRevealMat = new THREE.MeshLambertMaterial({
    color: C.sand,
    side: THREE.DoubleSide,
  });
  for (const sgn of [-1, 1] as const) {
    const sw = new THREE.Mesh(
      new THREE.PlaneGeometry(recessDepth, sideWallH),
      sideRevealMat,
    );
    sw.position.set(sgn * (aw / 2 + 0.2), sideWallH / 2, recessZCenter);
    sw.rotation.y = -sgn * Math.PI / 2;
    g.add(sw);
  }

  // ── IWAN VAULT (ceiling) ──────────────────────────────────────────
  // Beige sandstone ceiling — matches side reveals so the recess reads as one
  // continuous stone niche descending from vault to floor.
  const vaultMat = new THREE.MeshLambertMaterial({
    color: C.sand,
    side: THREE.DoubleSide,
  });
  const vaultMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(aw + 0.4, recessDepth),
    vaultMat,
  );
  vaultMesh.position.set(0, apex + 0.2, recessZCenter);
  vaultMesh.rotation.x = Math.PI / 2;
  g.add(vaultMesh);

  // ── MUQARNAS HALF-DOME (stalactite vault in the arch crown) ──────
  // A proper corbelled honeycomb filling the upper third of the iwan arch: rows of
  // small nested cells that narrow toward the apex (following the pointed arch) and
  // corbel FORWARD as they rise, with alternating lit/shadow cells so the cluster reads
  // as intricate light-and-dark stalactite work rather than a flat grid of blocks.
  // Sits against the iwan back wall, hanging from the apex down to the spring zone.
  const muqApexY   = apex - (apex - spring) * 0.06;   // top of the cluster (near apex)
  const muqBaseY   = spring + (apex - spring) * 0.30; // bottom of the cluster
  const muqBackZ   = backZ + 0.10;                    // hangs against the iwan back wall
  const muqLit    = mat(C.sandLight);                 // forward-facing cell soffits (lit)
  const muqShade  = mat(0x4a3318);                    // recessed cell pockets (shadow)
  const ROWS = 5;
  for (let row = 0; row < ROWS; row++) {
    const tg = row / (ROWS - 1);                       // 0 at bottom, 1 at top
    // Cell band Y centre, packed bottom→top.
    const yC = muqBaseY + (muqApexY - muqBaseY) * tg;
    const rowH = (muqApexY - muqBaseY) / ROWS * 1.15;
    // Width of this row narrows toward the apex (pointed-arch envelope).
    const env = Math.cos(tg * Math.PI * 0.42);         // 1 at base → ~0.7 at top
    const rowW = aw * 0.92 * env;
    // Higher rows corbel forward (toward viewer, +Z) — the overhang.
    const zC = muqBackZ + (frontZ - backZ) * 0.16 * tg;
    const cells = Math.max(2, Math.round(7 * env));    // fewer cells near apex
    const cellW = rowW / cells;
    for (let ci = 0; ci < cells; ci++) {
      const bx = -rowW / 2 + (ci + 0.5) * cellW;
      // Alternate the cells' projection so adjacent cells differ in depth → shadow lattice.
      const fwd = (ci + row) % 2 === 0;
      const cellD = fwd ? rowH * 0.9 : rowH * 0.5;
      const cellMat = fwd ? muqLit : muqShade;
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(cellW * 0.86, rowH * 0.9, cellD),
        cellMat,
      );
      cell.position.set(bx, yC, zC + cellD / 2);
      g.add(cell);
    }
  }

  // ── MOLDED CORNICE (3-layer stepped crowning) ─────────────────────
  // Replaces the old single cap slab with a proper Timurid-style cornice:
  //   Layer 1 (bottom projecting lip): widest + deepest, slight overhang on screen face
  //   Layer 2 (middle recessed band): narrower and shallower
  //   Layer 3 (top capstone):         narrowest, thinnest
  // All layers sit flush: bottom of layer 1 at y=h, stacking upward.
  // Depth spans backZ to frontZ so cornice covers the full pishtaq body from above.
  const corniceDepth = iwanDepth + 0.2;   // back-edge flush with iwan back (+0.2 overhang)
  const corniceZCenter = backZ + corniceDepth / 2;

  const sandDarkMat = mat(C.sandDark);
  const sandMat     = mat(C.sand);
  const sandLightMat = mat(C.sandLight);

  // Layer 1: projecting lower lip — overhangs screen face by ~0.3 on each side in x
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.8, 0.40, corniceDepth + 0.3),
    sandDarkMat,
  );
  lip.position.set(0, h + 0.20, corniceZCenter - 0.15);
  g.add(lip);

  // Thin turquoise inscription frieze on the front (+Z) face of the lip
  // Uses calligraphyBand texture (cobalt bg, white glyphs) clipped to a thin strip
  const friezeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.8, 0.22, 0.06),
    (() => {
      const tex = calligraphyBand(C.cobalt, 0xfff6e3);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round((w + 0.8) / 4)), 1);
      tex.needsUpdate = true;
      const plain = mat(C.cobalt);
      // +z face gets the frieze, everything else cobalt
      return [plain, plain, plain, plain, new THREE.MeshLambertMaterial({ map: tex }), plain];
    })(),
  );
  friezeMesh.position.set(0, h + 0.11, frontZ + 0.06);  // back face at frontZ+0.03, clear of screen front
  g.add(friezeMesh);

  // Layer 2: middle recessed band — sits on top of the lip
  const midBand = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.22, corniceDepth),
    sandMat,
  );
  midBand.position.set(0, h + 0.40 + 0.11, corniceZCenter);
  g.add(midBand);

  // Layer 3: top capstone — narrowest and thinnest
  const capstone = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.16, corniceDepth - 0.2),
    sandLightMat,
  );
  capstone.position.set(0, h + 0.40 + 0.22 + 0.08, corniceZCenter + 0.1);
  g.add(capstone);

  // ── SOLID SIDE WALLS (close the tall portal sides down to wing roofs) ──
  // From an elevated 3/4 view, the gap between the tall portal block (h=15) and the
  // lower wing roofs (wingH=7) exposes the open iwan interior on each side.
  // Fix: place a solid sandstone return-face panel at x=±w/2, spanning the full
  // portal depth (z from backZ to frontZ) at height from wingH to h.
  // PlaneGeometry (DoubleSide) is coplanar-safe: no z-fight since wings are outside x=±w/2
  // and the iwan side-reveals are at ±aw/2 (narrower), leaving the ±w/2 face open.
  if (wingH < h) {
    const sideWallHeight = h - wingH;
    const sideWallDepth  = frontZ - backZ;          // = d (full portal depth)
    const sideWallZCenter = (frontZ + backZ) / 2;   // midpoint of portal depth
    const sideReturnMat = new THREE.MeshLambertMaterial({ color: C.sand, side: THREE.DoubleSide });
    for (const sgn of [-1, 1] as const) {
      // PlaneGeometry in the YZ plane, facing ±X.
      const sw = new THREE.Mesh(
        new THREE.PlaneGeometry(sideWallDepth, sideWallHeight),
        sideReturnMat,
      );
      // Position at the screen edge; rotate to face outward
      sw.position.set(sgn * w / 2, wingH + sideWallHeight / 2, sideWallZCenter);
      sw.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(sw);
    }
  }

  // ── BASE PLINTH MOLDING ──────────────────────────────────────────
  // A stepped skirting at the base of the portal screen — adds depth.
  // Position: proud of the screen front face (+0.08 on front, -screenDepth+0.08 on back)
  // to avoid any z-fight with the screen slab at y=0..0.38.
  // Z center is at frontZ + 0.08 - screenDepth/2, ensuring front face protrudes clearly.
  const plinthMoldingZ = frontZ - (screenDepth - 0.16) / 2;
  const plinthMolding1 = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.6, 0.20, screenDepth + 0.16),
    mat(C.sandDark),
  );
  plinthMolding1.position.set(0, 0.10, plinthMoldingZ);
  g.add(plinthMolding1);

  const plinthMolding2 = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, 0.12, screenDepth + 0.08),
    mat(C.sandLight),
  );
  plinthMolding2.position.set(0, 0.26, frontZ - (screenDepth - 0.08) / 2);
  g.add(plinthMolding2);

  // ── SPANDREL BOSSES (proud rosette knobs in the arch spandrels) ──
  // Small chamfered cylinders at each spandrel — raise slightly off screen face.
  const bossR    = w * 0.028;
  const bossHalfW = aw / 2 + w * 0.06;
  const bossY    = (spring + apex) / 2;
  const bossZ    = frontZ + 0.06;  // proud of screen face
  const bossMat  = mat(C.gold);
  for (const sgn of [-1, 1] as const) {
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(bossR * 0.7, bossR, 0.10, 8),
      bossMat,
    );
    boss.position.set(sgn * bossHalfW, bossY, bossZ);
    boss.rotation.x = Math.PI / 2;
    g.add(boss);
  }

  // ── IWAN BACK WALL (rich mosaic texture) ──────────────────────────
  // DoubleSide so the wall also closes the iwan from BEHIND. The pishtaq stands
  // open-backed over the hollow courtyard; without a back face you see straight
  // through the arch from the rear and the muqarnas cells read as floating steps.
  const iwanTex = iwanTexture(variant);
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(aw + 0.4, apex + 0.4),
    new THREE.MeshLambertMaterial({
      map: iwanTex,
      emissive: new THREE.Color(C.lapis),
      emissiveIntensity: 0.20,
      side: THREE.DoubleSide,
    }),
  );
  backWall.position.set(0, (apex + 0.4) / 2, backZ + 0.07);
  g.add(backWall);

  return g;
}

/** Bulbous turquoise dome on a patterned drum.
 *  ribbed=true  → melon-fluted dome (Sher-Dor style): 24 soft rounded lobes
 *                 via custom BufferGeometry with r(θ,φ) = profile(θ) * (1 + A·cos(N·φ))
 *  ribbed=false → smooth onion dome (Tilya-Kori style): tall narrow onion lathe
 */
/** Dome drum radius as a fraction of the nominal dome radius `r`.
 *  Shared so the support-drum in madrasah.ts seats seamlessly under the dome.
 *  Widened from 0.74 → 0.86: a thin drum under a wide belly read as an umbrella;
 *  a wide drum lets the onion bulb sit on it with only a modest overhang. */
export const DRUM_R_FACTOR = 0.86;

export function dome(r: number, ribbed = false, glaze: number = C.turquoise): THREE.Group {
  const g = new THREE.Group();
  // Glaze tones derived from the base color: a dark valley + bright ridge for the
  // ribbed stripe map, so each dome's fluting reads in its own hue.
  const glazeCol = new THREE.Color(glaze);
  const valleyHex = '#' + glazeCol.clone().multiplyScalar(0.42).getHexString();
  const ridgeHex  = '#' + glazeCol.clone().lerp(new THREE.Color(0xffffff), 0.32).getHexString();
  const baseHex   = '#' + glazeCol.getHexString();

  // ── TALL INSCRIPTION DRUM ────────────────────────────────────────
  // Refs (every Registan dome) show a tall cylindrical drum carrying a grand
  // kufic inscription band, crowned by an arcaded gallery of small arched niches.
  const drumH = r * 1.05;             // tall drum (was 0.75) — dominant vertical
  const drumR  = r * DRUM_R_FACTOR;
  const drumTex = drumBand();
  drumTex.repeat.set(Math.max(2, Math.round(drumR * 2 * Math.PI / 3)), 1);
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR * 1.04, drumH, 28),
    new THREE.MeshLambertMaterial({ map: drumTex }),
  );
  drum.position.y = drumH / 2;
  g.add(drum);

  // ── ARCADED GALLERY RING (small arched niches around drum top) ────
  // archPanel texture wrapped around a short cylinder — the blind arcade gallery.
  const galH  = r * 0.30;
  const galTex = archPanel(512, 128);
  galTex.wrapS = THREE.RepeatWrapping;
  galTex.repeat.set(Math.max(4, Math.round(drumR * 2 * Math.PI / 1.6)), 1);
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR * 1.02, drumR, galH, 28),
    new THREE.MeshLambertMaterial({ map: galTex }),
  );
  gallery.position.y = drumH + galH / 2;
  g.add(gallery);

  // ── CORBEL COLLAR ─────────────────────────────────────────────────
  const collarY = drumH + galH;
  const collarH = r * 0.13;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR * 1.07, drumR * 1.03, collarH, 28),
    mat(C.sandLight),
  );
  collar.position.y = collarY + collarH / 2;
  g.add(collar);

  // ── LANTERN NICHE RING (collar-to-dome transition) ────────────────
  // Ring of small rectangular niches around the drum top, just above the collar.
  // Each niche is a cobalt box (surround) with a lighter recessed face.
  // rotation.y = -a makes local +Z face radially outward.
  const nicheCount    = ribbed ? 16 : 12;
  const nicheBaseY    = collarY + collarH;     // y just above collar
  const nicheRing     = drumR * 1.04;          // niche center radius (flush with collar top)
  const nicheH        = r * 0.16;
  const nicheArcW     = (Math.PI * 2 * nicheRing / nicheCount) * 0.72; // arc width
  const nicheDepth    = r * 0.07;              // radial depth of niche box
  const nichemat      = mat(C.cobalt);
  const nicheLightMat = mat(C.sandLight);
  for (let ni = 0; ni < nicheCount; ni++) {
    const a = (ni / nicheCount) * Math.PI * 2;
    const nx = Math.cos(a) * nicheRing;
    const nz = Math.sin(a) * nicheRing;
    // Cobalt niche surround — rotation.y = -a so +Z faces radially out
    const surround = new THREE.Mesh(
      new THREE.BoxGeometry(nicheArcW, nicheH, nicheDepth),
      nichemat,
    );
    surround.position.set(nx, nicheBaseY + nicheH / 2, nz);
    surround.rotation.y = -a;
    g.add(surround);
    // Light inner face (slightly recessed, smaller, sits on outer face center)
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(nicheArcW * 0.60, nicheH * 0.72, 0.06),
      nicheLightMat,
    );
    // Place outer face at nicheRing + nicheDepth/2, then inner is at same Z but pulled in a bit
    inner.position.set(
      Math.cos(a) * (nicheRing + nicheDepth / 2 + 0.04),
      nicheBaseY + nicheH * 0.4,
      Math.sin(a) * (nicheRing + nicheDepth / 2 + 0.04),
    );
    inner.rotation.y = -a;
    g.add(inner);
  }

  const capBase = collarY + collarH + nicheH * 0.6;  // dome sits slightly above lantern niches

  // ── SHARED ONION PROFILE ──────────────────────────────────────────
  // Piecewise-linear control points: (t, radius).
  // The bulb SPRINGS from the drum (base radius = drum top) and bulges only
  // modestly past it (belly ≈ 1.21× drum), then necks to a point — a tall onion,
  // NOT a wide canopy overhanging a thin stem (which read as a mushroom/umbrella).
  const capH = r * 1.95;  // tall bulb: height ≈ belly diameter

  const CTRL: [number, number][] = [
    [0.00, drumR * 1.03], // base: seats flush on the collar top (no skirt/ledge)
    [0.12, r * 0.98],     // springs upward and slightly out from the drum
    [0.30, r * 1.04],     // widest belly — modest swell, ~1.21× drum radius
    [0.48, r * 0.94],     // gentle shoulder
    [0.64, r * 0.66],     // smooth neck
    [0.80, r * 0.38],     // taper toward apex
    [0.92, r * 0.15],     // rounded near-apex (non-tent)
    [1.00, 0.0],          // apex point
  ];

  function profileRad(t: number): number {
    for (let i = 0; i < CTRL.length - 1; i++) {
      const [t0, r0] = CTRL[i];
      const [t1, r1] = CTRL[i + 1];
      if (t <= t1) {
        const u = (t - t0) / (t1 - t0);
        return r0 + (r1 - r0) * u;
      }
    }
    return 0;
  }

  // Smooth dome: Lambert with slight emissive glow.
  // Ribbed dome: Phong with flatShading — each faceted rib face gets a distinct
  // diffuse shading value from the directional light, making ribs read as light/dark stripes.
  if (ribbed) {
    // ── MELON-FLUTED CAP via BufferGeometry with stripe texture ────────
    // Geometry: r(θ,φ) = profile(θ) * (1 + A·cos(N·φ)) — scalloped surface.
    // 24 lobes (up from 16) for finer, crisper fluting matching refs.
    // Texture: vertical dark stripes at lobe valleys make ribs visible regardless
    // of lighting (critical because hemisphere lighting washes out geometry shading).
    const LOBES = 24;
    const AMP_MAX = 0.12;  // 12% scallop — melon fluting that reads without ballooning the belly
    const RINGS = 36;
    const SEGS  = LOBES * 6; // 144 azimuthal segs — smooth geometry

    // Build stripe texture: LOBES dark channels on turquoise
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 512; stripeCanvas.height = 256;
    const sg = stripeCanvas.getContext('2d')!;
    // Base glaze
    sg.fillStyle = baseHex;
    sg.fillRect(0, 0, 512, 256);
    // Dark valley stripes (N stripes across U=0..1)
    for (let i = 0; i < LOBES; i++) {
      const cx = (i + 0.5) / LOBES * 512;  // centre of each stripe
      const sw = 512 / LOBES * 0.26;         // stripe width: 26% of lobe pitch (slightly thinner for more lobes)
      // Dark valley
      sg.fillStyle = valleyHex;
      sg.fillRect(cx - sw / 2, 0, sw, 256);
      // Lighter highlight on ridge peak (halfway between valleys)
      const px2 = ((i + 1.0) / LOBES) * 512;
      const hw = sw * 0.45;
      sg.fillStyle = ridgeHex;
      sg.fillRect(px2 - hw / 2, 0, hw, 256);
    }
    // Fade stripes out near top (apex) — top 20% of texture fades to solid base glaze
    const fadeGrad = sg.createLinearGradient(0, 256 * 0.75, 0, 256);
    fadeGrad.addColorStop(0, `rgba(${glazeCol.r*255|0},${glazeCol.g*255|0},${glazeCol.b*255|0},0)`);
    fadeGrad.addColorStop(1, baseHex);
    sg.fillStyle = fadeGrad;
    sg.fillRect(0, 256 * 0.75, 512, 256 * 0.25);

    const stripeTex = new THREE.CanvasTexture(stripeCanvas);
    stripeTex.colorSpace = THREE.SRGBColorSpace;
    stripeTex.wrapS = THREE.RepeatWrapping;
    stripeTex.wrapT = THREE.ClampToEdgeWrapping;
    stripeTex.anisotropy = 4;

    const pos: number[] = [];
    const uvs: number[] = [];

    for (let ri = 0; ri <= RINGS; ri++) {
      const t = ri / RINGS;
      const pr = profileRad(t);
      const y  = capH * t;
      const envelope = Math.sin(Math.PI * Math.min(t / 0.80, 1.0));
      const amp = AMP_MAX * envelope;
      for (let si = 0; si <= SEGS; si++) {
        const phi = (si / SEGS) * Math.PI * 2;
        const sr = pr * (1 + amp * Math.cos(LOBES * phi));
        pos.push(Math.cos(phi) * sr, y, Math.sin(phi) * sr);
        // UV: u = azimuth (0..1 wraps LOBES times), v = height (0=base, 1=apex)
        uvs.push(si / SEGS * LOBES, t);  // repeat LOBES times around azimuth
      }
    }

    const idxArr: number[] = [];
    for (let ri = 0; ri < RINGS; ri++) {
      for (let si = 0; si < SEGS; si++) {
        const a = ri * (SEGS + 1) + si;
        const b = a + 1;
        const c = (ri + 1) * (SEGS + 1) + si;
        const d2 = c + 1;
        idxArr.push(a, c, b, b, c, d2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();

    const cap = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      map: stripeTex,
      emissive: glazeCol,
      emissiveIntensity: 0.12,
    }));
    cap.position.y = capBase;
    g.add(cap);

    // Gold finial sphere + crescent
    const finialBase = capBase + capH + r * 0.06;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 8), mat(C.gold));
    finial.position.y = finialBase;
    g.add(finial);
    // Crescent: two overlapping spheres (outer minus inner) approximated
    // by a torus-arc-like curved ring of small boxes
    const crescentR = r * 0.055;
    const crescentY = finialBase + r * 0.10;
    const crescentMat = mat(C.gold);
    const crescentPts = 6;
    for (let ci = 0; ci < crescentPts; ci++) {
      const a = Math.PI * 0.25 + (ci / (crescentPts - 1)) * Math.PI * 1.5;
      const cx = Math.cos(a) * crescentR;
      const cy = Math.sin(a) * crescentR * 0.55;
      const cSize = crescentR * (0.18 + Math.sin(ci / (crescentPts - 1) * Math.PI) * 0.10);
      const cBlock = new THREE.Mesh(new THREE.BoxGeometry(cSize, cSize, cSize * 0.5), crescentMat);
      cBlock.position.set(cx, crescentY + cy, 0);
      g.add(cBlock);
    }

  } else {
    // ── SMOOTH ONION CAP (TK grand dome) via LatheGeometry ───────────
    // Points go bottom→top (LatheGeometry sweeps around Y axis).
    const PROFILE_N = 28;
    const capPts: THREE.Vector2[] = [];
    for (let i = 0; i <= PROFILE_N; i++) {
      const t = i / PROFILE_N;
      capPts.push(new THREE.Vector2(profileRad(t), capH * t));
    }

    const cap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 40), new THREE.MeshLambertMaterial({
      color: glaze,
      emissive: glazeCol,
      emissiveIntensity: 0.18,
    }));
    cap.position.y = capBase;
    g.add(cap);

    // Gold finial sphere + crescent for smooth dome too
    const finialBase = capBase + capH + r * 0.06;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 8), mat(C.gold));
    finial.position.y = finialBase;
    g.add(finial);
    // Crescent for smooth dome (slightly larger)
    const crescentR2 = r * 0.07;
    const crescentY2 = finialBase + r * 0.12;
    const crescentMat2 = mat(C.gold);
    const crescentPts2 = 6;
    for (let ci = 0; ci < crescentPts2; ci++) {
      const a = Math.PI * 0.25 + (ci / (crescentPts2 - 1)) * Math.PI * 1.5;
      const cx = Math.cos(a) * crescentR2;
      const cy = Math.sin(a) * crescentR2 * 0.55;
      const cSize = crescentR2 * (0.18 + Math.sin(ci / (crescentPts2 - 1) * Math.PI) * 0.10);
      const cBlock = new THREE.Mesh(new THREE.BoxGeometry(cSize, cSize, cSize * 0.5), crescentMat2);
      cBlock.position.set(cx, crescentY2 + cy, 0);
      g.add(cBlock);
    }
  }

  return g;
}

/** Tapered minaret with bannai shaft, corbel cornice rings, balcony gallery (sharafa), and buff dome cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // ── SHAFT (tapered, spiral banna'i + kufic collars) ──────────────
  const shaftTex = minaretShaft();
  shaftTex.repeat.set(1, Math.max(1, Math.round(h / 8)));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const rBase = h * 0.095;  // slightly fatter base (real ones are stout)
  const rTop  = h * 0.058;  // top of shaft just below cornice
  const shaftH = h * 0.88;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBase, shaftH, 16), shaftMat);
  shaft.position.y = shaftH / 2;
  g.add(shaft);

  // ── MID-SHAFT SHARAFA (balcony ring at ~55% height) ──────────────
  // The signature corbelled balcony gallery partway up — sharafa.
  // Three corbel rings + a wider gallery band + a slim railing ring above.
  const sharafaBase = shaftH * 0.55;
  // Radius at sharafa height (linearly interpolated on the tapered shaft)
  const rAtSharafa = rBase + (rTop - rBase) * 0.55;
  // Three corbel rings stepping outward
  const sCorbels: [number, number, number][] = [
    [0.000, rAtSharafa * 1.08, h * 0.014],
    [0.018, rAtSharafa * 1.18, h * 0.016],
    [0.040, rAtSharafa * 1.30, h * 0.018],
  ];
  for (const [yOff, r, rh] of sCorbels) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.95, rh, 16),
      mat(C.sandDark),
    );
    ring.position.y = sharafaBase + yOff * h + rh / 2;
    g.add(ring);
  }
  const [sLastY, , sLastH] = sCorbels[2];
  const sGalleryBase = sharafaBase + sLastY * h + sLastH;
  const sGalleryR    = rAtSharafa * 1.28;
  const sGalleryH    = h * 0.040;
  const sGalleryTex  = archPanel(192, 96);
  const sGallery = new THREE.Mesh(
    new THREE.CylinderGeometry(sGalleryR, sGalleryR, sGalleryH, 16),
    new THREE.MeshLambertMaterial({ map: sGalleryTex }),
  );
  sGallery.position.y = sGalleryBase + sGalleryH / 2;
  g.add(sGallery);
  // Slim railing ring above gallery
  const sRailing = new THREE.Mesh(
    new THREE.CylinderGeometry(sGalleryR * 1.04, sGalleryR, h * 0.010, 16),
    mat(C.cream),
  );
  sRailing.position.y = sGalleryBase + sGalleryH + h * 0.005;
  g.add(sRailing);

  // ── CORBEL CORNICE (3 stacking rings, widening outward) ──────────
  const corniceBase = shaftH;
  const ringData: [number, number, number][] = [
    // [yOffset from corniceBase, radius, ringHeight]
    [0.000, rTop * 1.10, h * 0.018],
    [0.024, rTop * 1.22, h * 0.022],
    [0.052, rTop * 1.38, h * 0.026],
  ];
  for (const [yOff, r, rh] of ringData) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 0.96, rh, 16),
      mat(C.cream),
    );
    ring.position.y = corniceBase + yOff * h + rh / 2;
    g.add(ring);
  }

  // ── DOME CAP (buff/sand sphere sits directly on cornice, no bare cylinder) ─
  const [lastYOff, , lastRH] = ringData[2];
  const capBase = corniceBase + lastYOff * h + lastRH + h * 0.008;
  const capR    = rTop * 1.05;  // slightly wider than top cornice ring for a clean shoulder
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 12, 10), mat(C.sand));
  cap.position.y = capBase + capR * 0.82;
  g.add(cap);

  // ── FINIAL ────────────────────────────────────────────────────────
  const finial = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.22, 8, 8), mat(C.gold));
  finial.position.y = capBase + capR * 1.68;
  g.add(finial);

  return g;
}

/**
 * Two-storey arcade wall: patterned side faces, arch-panel front, calligraphy top band.
 * wingStyle controls the exterior face identity:
 *   'diagonal-lattice' (default / UB): bannai diagonal with star accents
 *   'meander' (SD): meander-dominant colorway — cobalt/cream swastika-meander
 *   'arch-floral' (TK): arch panels with warm floral-ish accent (gold dots on cream)
 */
export function arcadeWall(
  len: number, h: number, d: number,
  wingStyle: 'diagonal-lattice' | 'meander' | 'arch-floral' = 'diagonal-lattice',
): THREE.Group {
  const g = new THREE.Group();

  // Side/back faces: upgraded brick wall with seeded tonal variation + banna'i diamonds
  // 'meander' (SD): buff/sand field, cobalt outer diamond, turquoise inner accent —
  // matches ref photo warm stone + sparse blue geometric tracery economy.
  // brickWall(bg, line, motif): line=inner, motif=outer → (sand, turquoise, cobalt).
  let extTex: THREE.Texture;
  if (wingStyle === 'meander') {
    extTex = brickWall(C.sand, C.turquoise, C.cobalt);
  } else if (wingStyle === 'arch-floral') {
    extTex = brickWall(C.sand, C.cream, C.gold);
  } else {
    extTex = brickWall(C.sand, C.cream, C.cobalt);
  }

  // Arcade facade texture for the +Z front face
  const goldTrim = (wingStyle === 'arch-floral');
  const facadeTex = arcadeFacade(len, h, goldTrim);

  // Wall slab: arcade face on +Z front, brick on sides/back
  g.add(patternedBoxMulti(len, h, d, C.sand, {
    pz: facadeTex, // full 2-storey arcade facade
    px: extTex,
    nx: extTex,
    nz: extTex,   // outside back
  }));

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL RECESSED HUJRA ARCADES
// Each facade gets a genuine 3-D screen with punched pointed-arch holes, a
// recessed back wall behind the openings, and all the framing relief layers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a multi-hole ExtrudeGeometry for one storey of N pointed-arch niches.
 * The solid rectangle is len × storyH; each arch is a hole punched through it.
 * Extruded to `depth` in +Z (caller positions it so +Z faces outward/plaza).
 *
 * archW: width of each arch opening
 * archSpring: height of springing (base of the curved part)
 * archApex: height of arch apex tip
 */
function hujraStoryGeometry(
  len: number,
  storyH: number,
  bays: number,
  archWFrac: number,   // arch width as fraction of bay width
  springFrac: number,  // springing height as fraction of storyH
  apexFrac: number,    // apex height as fraction of storyH
  depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Outer rectangle (origin bottom-left)
  shape.moveTo(0, 0);
  shape.lineTo(len, 0);
  shape.lineTo(len, storyH);
  shape.lineTo(0, storyH);
  shape.closePath();

  const bayW   = len / bays;
  const aw     = bayW * archWFrac;
  const spring = storyH * springFrac;
  const apex   = storyH * apexFrac;

  for (let b = 0; b < bays; b++) {
    const cx = (b + 0.5) * bayW;  // bay centre x
    const hole = new THREE.Path();
    // Bottom-left of arch opening, go around counter-clockwise (hole winding)
    hole.moveTo(cx - aw / 2, 0.01);
    hole.lineTo(cx + aw / 2, 0.01);
    hole.lineTo(cx + aw / 2, spring);
    // Right bezier side up to apex
    hole.bezierCurveTo(
      cx + aw / 2, spring + (apex - spring) * 0.55,
      cx + aw * 0.30, apex - (apex - spring) * 0.18, cx, apex,
    );
    // Left bezier side down from apex
    hole.bezierCurveTo(
      cx - aw * 0.30, apex - (apex - spring) * 0.18,
      cx - aw / 2, spring + (apex - spring) * 0.55, cx - aw / 2, spring,
    );
    hole.closePath();
    shape.holes.push(hole);
  }

  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

// Shared banna'i diamond-net tile field material, cached per wingStyle so all
// 16 wing facades + frames reuse ONE texture/material each (performance).
const _hujraFieldCache = new Map<string, THREE.MeshLambertMaterial>();
function hujraFieldMat(wingStyle: 'diagonal-lattice' | 'meander' | 'arch-floral'): THREE.MeshLambertMaterial {
  const hit = _hujraFieldCache.get(wingStyle);
  if (hit) return hit;
  let tex: THREE.Texture;
  if (wingStyle === 'meander')          tex = brickWall(C.sand, C.turquoise, C.cobalt);
  else if (wingStyle === 'arch-floral') tex = brickWall(C.sand, C.cream, C.gold);
  else                                  tex = brickWall(C.sand, C.cream, C.cobalt);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // brickWall is 1024² tileable; ~3.0 world-units per tile keeps diamonds large like refs.
  tex.repeat.set(1 / 3.0, 1 / 3.0);
  const m = new THREE.MeshLambertMaterial({ map: tex });
  _hujraFieldCache.set(wingStyle, m);
  return m;
}

// Shared cobalt frame material for the rectangular tile border around each arch.
const _frameMat = new THREE.MeshLambertMaterial({ color: C.cobalt });
// Shared deep-shadow soffit material — the reveal/ceiling inside each arch opening.
const _archSoffitMat = new THREE.MeshLambertMaterial({ color: 0x2a1d10 });
// Shared hujra-detail materials (one instance reused across all 16 facades).
const _returnMat = new THREE.MeshLambertMaterial({ color: 0x33240f });       // deep-shadow reveal
const _marbleMat = new THREE.MeshLambertMaterial({ color: C.marble });        // sills
const _outlineMat = new THREE.MeshLambertMaterial({ color: C.turquoise, emissive: new THREE.Color(C.turquoise), emissiveIntensity: 0.14 });
const _accentTurqMat = new THREE.MeshLambertMaterial({ color: C.turquoise, emissive: new THREE.Color(C.turquoise), emissiveIntensity: 0.10 });
const _accentGoldMat = new THREE.MeshLambertMaterial({ color: C.gold, emissive: new THREE.Color(C.gold), emissiveIntensity: 0.10 });

// Reduce an ExtrudeGeometry to a single-group, position+normal+uv geometry so it can
// be merged with mergeGeometries(useGroups=false). Drops material groups (we paint the
// whole merged result one colour) and keeps only the attributes all bins share.
function toNonIndexedSingleGroup(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g2 = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g2.getAttribute('position').clone());
  if (g2.getAttribute('normal')) out.setAttribute('normal', g2.getAttribute('normal').clone());
  else out.computeVertexNormals();
  if (g2.getAttribute('uv')) out.setAttribute('uv', g2.getAttribute('uv').clone());
  if (g2 !== geo) g2.dispose();
  return out;
}

/**
 * Recessed hujra arcade face — the crown jewel replacement for flat arcadeFacade texture.
 *
 * Builds a face Group that goes on ONE facade surface (e.g. +Z face of a wing):
 *   • 2-storey arcade screen: extruded proud stone wall with punched pointed-arch holes
 *   • Recessed back wall: darker sand plane, `recessDepth` behind the screen face
 *   • Dado (marble band) at base
 *   • Kufic inscription cornice band at top
 *   • Pilaster strips between bays (thin cobalt boxes, slightly proud of screen face)
 *   • Spandrel tile rosettes on the screen between arches
 *
 * Position: the Group's local origin is at the facade surface.
 * The screen front face sits at z=0; everything recesses in −Z.
 * Caller rotates/positions this group onto the correct wing face.
 *
 * len, h  : world dimensions of this facade face
 * bays    : number of arch bays (typically 2–7 per wing)
 * goldTrim: TK-style gold accent lines in kufic band
 * wingStyle: controls screen and pilaster material palette
 */
export function recessedHujraFace(
  len: number,
  h: number,
  bays: number,
  opts: {
    goldTrim?: boolean;
    wingStyle?: 'diagonal-lattice' | 'meander' | 'arch-floral';
    isGroundFloor?: boolean; // ground floor niches read darker (doorways)
  } = {},
): THREE.Group {
  const g = new THREE.Group();
  const goldTrim   = opts.goldTrim   ?? false;
  const wingStyle  = opts.wingStyle  ?? 'diagonal-lattice';

  // ── PROPORTIONS & Z-LAYOUT (forward cavity, real depth) ──────────
  // The wing box is SOLID with its face at local z=0, so a true cavity must live IN
  // FRONT of that face. The dark back wall sits a hair proud of the box face (so it is
  // never buried in solid geometry and reads dark through the arch holes); the arcade
  // screen stands proud by the cavity depth. Projection is kept MODEST (≈0.45) so the
  // building's front plane advances only slightly and walkable clearances are preserved.
  //
  //   z = 0          : solid box face (behind everything)
  //   z = BACK_Z     : dark niche back wall (just proud of box, hides its face)
  //   z = SCREEN_FRONT − SCREEN_DEPTH .. SCREEN_FRONT : proud arcade screen slab
  const BACK_Z       = 0.06;            // dark back wall, clearly proud of box face (no z-fight)
  const RECESS_DEPTH = 0.34;            // visible inward depth (back wall → screen back)
  const SCREEN_DEPTH = 0.22;            // arcade screen slab thickness
  const SCREEN_FRONT = BACK_Z + RECESS_DEPTH + SCREEN_DEPTH;   // ≈0.62 proud front
  const PROUD        = SCREEN_FRONT;    // top of relief (used by trims/frames)

  const DADO_H       = h * 0.085;  // marble dado band at base
  const CORNICE_H    = h * 0.105;  // kufic inscription cornice band
  const arcadeH      = h - DADO_H - CORNICE_H;

  // Two storeys, UNEQUAL: lower storey taller (the deep hujra cells / doorways),
  // upper storey shorter (matches every Registan ref: tall ground arcade, low gallery).
  const STORIES = 2;
  const LOWER_FRAC = 0.57;                   // lower storey = 57% of arcade band
  const storyHs = [arcadeH * (1 - LOWER_FRAC), arcadeH * LOWER_FRAC]; // [upper, lower]
  // y-base of each storey from the dado top (index 0 = upper sits ON TOP of lower)
  const storyBaseY = [DADO_H + arcadeH * LOWER_FRAC, DADO_H];          // [upper, lower]

  // Arch proportions — per storey so each reads as a true pointed Persian arch.
  // Lower storey: taller, deeper niches. Upper: slightly stubbier.
  const ARCH_W_FRAC  = 0.66;   // arch width as fraction of bay (frame border fills the rest)
  const SPRING_FRAC  = [0.40, 0.44];  // [upper, lower]
  const APEX_FRAC    = [0.84, 0.86];

  // ── MATERIALS (shared module-level so 16 facades reuse them) ───────
  const screenFrontMat = hujraFieldMat(wingStyle);   // banna'i diamond-net tile field
  // Arch-hole soffit (the extruded sides of each punched arch) = deep shadow so
  // every opening reads as a true dark recess, not a flat painted arch.
  const screenSideMat  = _archSoffitMat;

  // Niche back wall — near-black to maximise shadow contrast through the arch holes.
  // DoubleSide so it renders regardless of which way the Group is rotated (courtyard vs plaza).
  const backWallColor = 0x140d07;  // near-black — deep iwan shadow
  const backWallMat   = new THREE.MeshLambertMaterial({
    color: backWallColor,
    side: THREE.DoubleSide,
  });

  // Dado
  const dadoMat = new THREE.MeshLambertMaterial({ color: C.marble });

  // Pilaster strips — banna'i tile field (shared), slightly proud
  const pilasterMat   = screenFrontMat;

  // ── 1. DADO (marble base band) ────────────────────────────────────
  // Solid marble plinth filling the cavity base, from the box face (z=0) to the
  // proud screen front (z=SCREEN_FRONT).
  const dadoD = SCREEN_FRONT + 0.02;  // box face → proud screen front
  const dadoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, DADO_H, dadoD),
    dadoMat,
  );
  dadoMesh.position.set(0, DADO_H / 2, dadoD / 2 - 0.01);
  g.add(dadoMesh);

  // Dado top trim line (thin cobalt string-course at dado top, proud of screen face)
  const dadoTrim = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.08, 0.10),
    new THREE.MeshLambertMaterial({ color: C.cobalt }),
  );
  dadoTrim.position.set(0, DADO_H + 0.04, SCREEN_FRONT + 0.08);  // 0.08 proud of screen front, clear of frame front (0.64)
  g.add(dadoTrim);

  // ── 2. ARCADE SCREEN (two storeys of punched arches) ─────────────
  // ExtrudeGeometry: shape extruded +Z by SCREEN_DEPTH. We want front face at
  // SCREEN_FRONT, so the shape origin (back of slab) sits at SCREEN_FRONT - SCREEN_DEPTH.
  const SCREEN_Z_ORIGIN = SCREEN_FRONT - SCREEN_DEPTH;

  for (let s = 0; s < STORIES; s++) {
    const storyH     = storyHs[s];
    const storyYBase = storyBaseY[s];

    const geo = hujraStoryGeometry(
      len, storyH, bays,
      ARCH_W_FRAC, SPRING_FRAC[s], APEX_FRAC[s],
      SCREEN_DEPTH,
    );

    const screenMesh = new THREE.Mesh(geo, [screenFrontMat, screenSideMat]);
    // shape coords: x in 0..len, y in 0..storyH. Centre x by shifting -len/2.
    screenMesh.position.set(-len / 2, storyYBase, SCREEN_Z_ORIGIN);
    screenMesh.castShadow = true;
    screenMesh.receiveShadow = true;
    g.add(screenMesh);
  }

  // ── 3. RECESSED BACK WALL ─────────────────────────────────────────
  // A thin box (not PlaneGeometry) so it has proper faces regardless of rotation.
  // Sits at z = BACK_Z, rendering as a deep dark surface visible through arch holes.
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(len, arcadeH, 0.08),
    backWallMat,
  );
  backWall.position.set(0, DADO_H + arcadeH / 2, BACK_Z);
  backWall.receiveShadow = true;
  g.add(backWall);

  // ── 4–6. RETURNS, SILLS, PILASTERS, FRAMES, OUTLINES ─────────────
  // PERFORMANCE: these repeat per bay/storey. Rather than emit dozens of tiny meshes
  // per facade (×16 facades → heavy draw-call load), we accumulate geometries into
  // per-material bins and merge each bin into ONE mesh. Cuts ~45 meshes/facade to ~10.
  const bayW      = len / bays;
  const archW     = bayW * ARCH_W_FRAC;
  const returnDepth = SCREEN_FRONT - BACK_Z + 0.04;       // cavity depth (back wall → front)
  const returnZCenter = BACK_Z + (SCREEN_FRONT - BACK_Z) / 2;

  const returnMat = _returnMat;
  const marbleMat = _marbleMat;
  const archOutlineMat = _outlineMat;
  const accentMat = goldTrim ? _accentGoldMat : _accentTurqMat;

  const FRAME_DEPTH   = 0.10;
  const OUTLINE_DEPTH = 0.07;
  const frameZ   = PROUD + 0.02;  // frame front at PROUD+0.02 (0.64)
  const outlineZ = PROUD + 0.14;  // outline front at PROUD+0.14 (0.76) — clear of cornice trim (0.68) and frame (0.64)
  const pilasterW = Math.min(bayW * 0.22, 0.9);
  const pilasterFront = SCREEN_FRONT + 0.06;
  const pilasterD = pilasterFront + 0.02;
  const pilasterZCenter = pilasterFront - pilasterD / 2;

  // Geometry bins (cloned + transformed, then merged per material)
  const returnGeos: THREE.BufferGeometry[] = [];
  const sillGeos:   THREE.BufferGeometry[] = [];
  const pilasterGeos: THREE.BufferGeometry[] = [];
  const accentGeos:   THREE.BufferGeometry[] = [];
  const frameGeos:    THREE.BufferGeometry[] = [];
  const outlineGeos:  THREE.BufferGeometry[] = [];

  const _m = new THREE.Matrix4();
  const pushBox = (bin: THREE.BufferGeometry[], w: number, hh: number, dd: number, x: number, y: number, z: number) => {
    const gg = new THREE.BoxGeometry(w, hh, dd);
    gg.applyMatrix4(_m.makeTranslation(x, y, z));
    bin.push(gg);
  };

  function pointedArchPath(p: THREE.Path | THREE.Shape, cx: number, aw: number, sp: number, ap: number, y0: number) {
    p.moveTo(cx - aw / 2, y0);
    p.lineTo(cx - aw / 2, sp);
    p.bezierCurveTo(cx - aw / 2, sp + (ap - sp) * 0.55, cx - aw * 0.30, ap - (ap - sp) * 0.18, cx, ap);
    p.bezierCurveTo(cx + aw * 0.30, ap - (ap - sp) * 0.18, cx + aw / 2, sp + (ap - sp) * 0.55, cx + aw / 2, sp);
    p.lineTo(cx + aw / 2, y0);
  }

  for (let s = 0; s < STORIES; s++) {
    const storyH = storyHs[s];
    const sBaseY = storyBaseY[s];
    const returnH = SPRING_FRAC[s] * storyH;
    const halfA = archW / 2;
    const aw  = bayW * ARCH_W_FRAC;
    const sp  = storyH * SPRING_FRAC[s];
    const ap  = storyH * APEX_FRAC[s];
    const inset = bayW * 0.06;

    for (let b = 0; b < bays; b++) {
      const cxLocal = (b + 0.5) * bayW - len / 2;  // bay centre, centred coords
      const cx      = (b + 0.5) * bayW;            // bay centre, 0..len coords

      // (4a) Returns — thin vertical boxes flanking each niche (replaces planes).
      pushBox(returnGeos, 0.05, returnH, returnDepth, cxLocal - halfA, sBaseY + returnH / 2, returnZCenter);
      pushBox(returnGeos, 0.05, returnH, returnDepth, cxLocal + halfA, sBaseY + returnH / 2, returnZCenter);
      // (4b) Marble sill at niche base.
      pushBox(sillGeos, archW + 0.04, 0.07, returnDepth * 0.96, cxLocal, sBaseY + 0.035, returnZCenter);

      // (6a) Cobalt rectangular frame: bay rectangle minus the arch hole.
      const frameShape = new THREE.Shape();
      const fx0 = b * bayW + inset, fx1 = (b + 1) * bayW - inset;
      frameShape.moveTo(fx0, 0.02); frameShape.lineTo(fx1, 0.02);
      frameShape.lineTo(fx1, storyH - 0.02); frameShape.lineTo(fx0, storyH - 0.02);
      frameShape.closePath();
      const fhole = new THREE.Path();
      pointedArchPath(fhole, cx, aw, sp, ap, 0.03); fhole.closePath();
      frameShape.holes.push(fhole);
      const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: FRAME_DEPTH, bevelEnabled: false });
      frameGeo.applyMatrix4(_m.makeTranslation(-len / 2, sBaseY, frameZ - FRAME_DEPTH));
      frameGeos.push(toNonIndexedSingleGroup(frameGeo));

      // (6b) Turquoise outline ring inside the frame, hugging the arch.
      const OUTLINE_W = bayW * 0.030;
      const ow = aw + OUTLINE_W * 2;
      const outShape = new THREE.Shape();
      pointedArchPath(outShape, cx, ow, sp + OUTLINE_W, ap + OUTLINE_W, 0); outShape.closePath();
      const inHole = new THREE.Path();
      pointedArchPath(inHole, cx, aw, sp, ap, 0.01); inHole.closePath();
      outShape.holes.push(inHole);
      const outGeo = new THREE.ExtrudeGeometry(outShape, { depth: OUTLINE_DEPTH, bevelEnabled: false });
      outGeo.applyMatrix4(_m.makeTranslation(-len / 2, sBaseY, outlineZ - OUTLINE_DEPTH));
      outlineGeos.push(toNonIndexedSingleGroup(outGeo));
    }
  }

  // (5) Pilasters + accents between bays.
  for (let b = 0; b <= bays; b++) {
    const bx = (b * bayW) - len / 2;
    pushBox(pilasterGeos, pilasterW, arcadeH, pilasterD, bx, DADO_H + arcadeH / 2, pilasterZCenter);
    pushBox(accentGeos, pilasterW * 0.22, arcadeH * 0.9, 0.06, bx, DADO_H + arcadeH / 2, PROUD + 0.18);  // proud of outline rings (0.76) by 0.02
  }

  // Merge each bin into ONE mesh.
  const addMerged = (bin: THREE.BufferGeometry[], material: THREE.Material, cast: boolean) => {
    if (!bin.length) return;
    const merged = mergeGeometries(bin, false);
    bin.forEach(b => b.dispose());
    if (!merged) return;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast; m.receiveShadow = true;
    g.add(m);
  };
  addMerged(returnGeos,  returnMat,      false);
  addMerged(sillGeos,    marbleMat,      false);
  addMerged(pilasterGeos, pilasterMat,   true);
  addMerged(accentGeos,  accentMat,      false);
  addMerged(frameGeos,   _frameMat,      true);
  addMerged(outlineGeos, archOutlineMat, false);

  // ── 7. KUFIC INSCRIPTION CORNICE BAND ────────────────────────────
  // Cobalt band with white kufic at the top of the facade, above the arcade stories.
  const corniceTex = calligraphyBand(C.cobalt, 0xfff6e3);
  corniceTex.wrapS = corniceTex.wrapT = THREE.RepeatWrapping;
  corniceTex.repeat.set(Math.max(1, Math.round(len / 5)), 1);
  const corniceY = DADO_H + arcadeH;  // top of arcade zone
  // Cornice spans box face (z=0) to a touch proud of the screen front (caps the arcade).
  const corniceFront = SCREEN_FRONT + 0.10;
  const corniceD = corniceFront + 0.02;
  const corniceZCenter = corniceFront - corniceD / 2;

  const corniceMesh = new THREE.Mesh(
    new THREE.BoxGeometry(len, CORNICE_H, corniceD),
    [
      new THREE.MeshLambertMaterial({ color: C.cobalt }),   // +x
      new THREE.MeshLambertMaterial({ color: C.cobalt }),   // -x
      new THREE.MeshLambertMaterial({ color: C.cobalt }),   // +y (top)
      new THREE.MeshLambertMaterial({ color: C.cobalt }),   // -y
      new THREE.MeshLambertMaterial({ map: corniceTex }),   // +z (front/plaza face)
      new THREE.MeshLambertMaterial({ color: C.cobalt }),   // -z
    ],
  );
  corniceMesh.position.set(0, corniceY + CORNICE_H / 2, corniceZCenter);
  corniceMesh.castShadow = true;
  g.add(corniceMesh);

  // Coloured trim line under the cornice
  const trimColor = goldTrim ? C.gold : C.turquoise;
  const corniceUnderTrim = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.07, 0.12),
    new THREE.MeshLambertMaterial({
      color: trimColor,
      emissive: new THREE.Color(trimColor),
      emissiveIntensity: 0.14,
    }),
  );
  corniceUnderTrim.position.set(0, corniceY + 0.035, SCREEN_FRONT + 0.08);  // 0.08 proud of screen, clear of frame/outline
  g.add(corniceUnderTrim);

  return g;
}
