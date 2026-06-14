import * as THREE from 'three';
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

  // ── MUQARNAS SUGGESTION (arch soffit zone) ──────────────────────
  // Stacked corbelled boxes along the arch soffit to suggest stalactite
  // vaulting. Three tiers of small chamfered blocks, stepping inward
  // from the arch face, placed at the spring zone of the arch.
  // They sit in the iwan entrance, attached to the screen inner face.
  const muqarnasZ = frontZ - screenDepth - 0.05; // just inside the arch
  const muqMat = mat(C.sandDark);
  const muqLightMat = mat(C.sandLight);
  const TIERS = 3;
  for (let tier = 0; tier < TIERS; tier++) {
    const tierW = aw * (1.0 - tier * 0.16);        // each tier narrows
    const tierH = (apex - spring) * 0.08;           // thin slab
    const tierY = spring + (apex - spring) * (0.12 + tier * 0.24); // step up
    const tierZ = muqarnasZ - tier * 0.12;          // step back into recess
    const blockCount = 5 + tier * 2;                // more blocks per tier
    const blockW = tierW / blockCount;
    for (let bi = 0; bi < blockCount; bi++) {
      const bx = -tierW / 2 + (bi + 0.5) * blockW;
      const isOdd = bi % 2 === 1;
      const blockH = isOdd ? tierH * 1.4 : tierH;   // alternate heights
      const bMat = isOdd ? muqMat : muqLightMat;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(blockW * 0.82, blockH, 0.14 + tier * 0.06),
        bMat,
      );
      block.position.set(bx, tierY + blockH / 2, tierZ);
      g.add(block);
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
  friezeMesh.position.set(0, h + 0.11, frontZ + 0.03);
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
  const iwanTex = iwanTexture(variant);
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(aw + 0.4, apex + 0.4),
    new THREE.MeshLambertMaterial({
      map: iwanTex,
      emissive: new THREE.Color(C.lapis),
      emissiveIntensity: 0.20,
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
export function dome(r: number, ribbed = false): THREE.Group {
  const g = new THREE.Group();

  // ── DRUM ─────────────────────────────────────────────────────────
  const drumH = r * 0.75;
  const drumR  = r * 0.72;
  const drumTex = drumBand();
  drumTex.repeat.set(Math.max(1, Math.round(drumR * 2 * Math.PI / 3)), 1);
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR * 1.05, drumH, 24),
    new THREE.MeshLambertMaterial({ map: drumTex }),
  );
  drum.position.y = drumH / 2;
  g.add(drum);

  // ── CORBEL COLLAR ─────────────────────────────────────────────────
  const collarY = drumH;
  const collarH = r * 0.14;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR * 1.08, drumR * 1.04, collarH, 24),
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
  // capH = 2.0r → dome is 2× taller than its belly width → tall onion not flat saucer.
  // Peak belly only 5% wider than r so the dome reads as compact/spherical, not bulging.
  const capH = r * 2.0;

  const CTRL: [number, number][] = [
    [0.00, drumR],        // base: smooth join to collar
    [0.15, r * 0.92],    // rise from collar — slightly narrower than drum
    [0.32, r * 1.06],    // widest belly — modest swell
    [0.50, r * 0.72],    // shoulder narrows sharply — key onion pinch zone
    [0.68, r * 0.30],    // slim neck — tight like true Central Asian onion
    [0.84, r * 0.12],    // taper toward apex — added for rounder, non-tent apex
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
    const AMP_MAX = 0.16;  // 16% scallop — slightly less than before to keep profile clean
    const RINGS = 36;
    const SEGS  = LOBES * 6; // 144 azimuthal segs — smooth geometry

    // Build stripe texture: LOBES dark channels on turquoise
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 512; stripeCanvas.height = 256;
    const sg = stripeCanvas.getContext('2d')!;
    // Base turquoise
    sg.fillStyle = '#42c8c8';
    sg.fillRect(0, 0, 512, 256);
    // Dark valley stripes (N stripes across U=0..1)
    for (let i = 0; i < LOBES; i++) {
      const cx = (i + 0.5) / LOBES * 512;  // centre of each stripe
      const sw = 512 / LOBES * 0.26;         // stripe width: 26% of lobe pitch (slightly thinner for more lobes)
      // Dark teal valley
      sg.fillStyle = '#1a8080';
      sg.fillRect(cx - sw / 2, 0, sw, 256);
      // Lighter highlight on ridge peak (halfway between valleys)
      const px2 = ((i + 1.0) / LOBES) * 512;
      const hw = sw * 0.45;
      sg.fillStyle = '#5ae0e0';
      sg.fillRect(px2 - hw / 2, 0, hw, 256);
    }
    // Fade stripes out near top (apex) — top 20% of texture fades to solid
    const fadeGrad = sg.createLinearGradient(0, 256 * 0.75, 0, 256);
    fadeGrad.addColorStop(0, 'rgba(66,200,200,0)');
    fadeGrad.addColorStop(1, 'rgba(66,200,200,1)');
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
      emissive: new THREE.Color(C.turquoise),
      emissiveIntensity: 0.10,
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
      color: C.turquoise,
      emissive: new THREE.Color(C.turquoise),
      emissiveIntensity: 0.16,
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

  // ── GALLERY (short cylinder with arch-panel band) ─────────────────
  const [lastYOff, , lastRH] = ringData[2];
  const galleryBase = corniceBase + lastYOff * h + lastRH;
  const galleryR    = rTop * 1.32;
  const galleryH    = h * 0.065;
  const galleryTex  = archPanel(256, 128);
  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(galleryR, galleryR, galleryH, 16),
    new THREE.MeshLambertMaterial({ map: galleryTex }),
  );
  gallery.position.y = galleryBase + galleryH / 2;
  g.add(gallery);

  // ── CROWN RAILING (slim ring above gallery, just below cap) ──────
  const crownRailing = new THREE.Mesh(
    new THREE.CylinderGeometry(galleryR * 1.05, galleryR, h * 0.010, 16),
    mat(C.sandLight),
  );
  crownRailing.position.y = galleryBase + galleryH + h * 0.005;
  g.add(crownRailing);

  // ── DOME CAP (buff/sand sphere — NOT turquoise, refs show buff caps) ─
  const capBase = galleryBase + galleryH + h * 0.012;
  const capR    = galleryR * 0.80;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 12, 10), mat(C.sand));
  cap.position.y = capBase + capR * 0.85;
  g.add(cap);

  // ── FINIAL ────────────────────────────────────────────────────────
  const finial = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.22, 8, 8), mat(C.gold));
  finial.position.y = capBase + capR * 1.75;
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
