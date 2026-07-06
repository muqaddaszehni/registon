import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../palette';
import { archPanel, portalTexture, iwanTexture, ropeTexture, brickWall, drumBand, minaretShaft, girihTile, arcadeFacade, calligraphyBand, type PortalVariant } from '../patterns/textures';
import { textureRegistry } from '../scene/lod';
import { lanternRow, type LanternSite } from './lanterns';

export const mat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const matMap = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });

// Shared polished-brass material for finials/crescents/column tips — Phong specular
// reads as a hot glint that UnrealBloom catches as a sparkle.
const goldShiny = new THREE.MeshPhongMaterial({
  color: C.gold,
  specular: 0xe6d6b4,
  shininess: 58,
  emissive: new THREE.Color(C.gold),
  emissiveIntensity: 0.06,
});

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
  const geo = new THREE.BoxGeometry(w, h, d);
  // Cheap baked contact-AO: darken the base vertex ring (and slightly the top), which
  // the side faces interpolate into a vertical gradient — grounds the big tiled wing
  // masses and darkens the wall/plinth and wall/cornice junctions. Zero extra geometry.
  const pos = geo.getAttribute('position');
  const colArr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const v = y < -h / 2 * 0.98 ? 0.62 : (y > h / 2 * 0.98 ? 0.84 : 1.0);
    colArr[i * 3] = v; colArr[i * 3 + 1] = v; colArr[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  mats.forEach(mm => { (mm as THREE.MeshLambertMaterial).vertexColors = true; });
  const m = new THREE.Mesh(geo, mats);
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
  const tipMat = goldShiny;

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
    color: C.sandDark,   // grade the reveal into shadow so the recess reads deep
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
    color: C.sandDark,   // darker ceiling so the recess falls into shadow
    side: THREE.DoubleSide,
  });
  const vaultMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(aw + 0.4, recessDepth),
    vaultMat,
  );
  vaultMesh.position.set(0, apex + 0.2, recessZCenter);
  vaultMesh.rotation.x = Math.PI / 2;
  g.add(vaultMesh);

  // ── IWAN HALF-DOME HOOD (semi-vault the muqarnas hangs from) ─────
  // A dome-of-revolution at the back-top: its visible front half curves from the
  // apex down to the spring line so the recess resolves into a curved hood (not a
  // flat box), grading the shadow falloff. DoubleSide → the concave inside renders.
  const hoodR = aw / 2 + 0.15;
  const hoodH = (apex - spring) * 0.95;
  const hoodPts: THREE.Vector2[] = [];
  const HN = 10;
  for (let i = 0; i <= HN; i++) {
    const t = i / HN;   // 0 base(spring) → 1 apex
    hoodPts.push(new THREE.Vector2(Math.cos(t * Math.PI / 2) * hoodR, Math.sin(t * Math.PI / 2) * hoodH));
  }
  const hoodMesh = new THREE.Mesh(
    new THREE.LatheGeometry(hoodPts, 24),
    new THREE.MeshLambertMaterial({ color: C.sandDark, side: THREE.DoubleSide }),
  );
  hoodMesh.position.set(0, spring, backZ + 0.3);
  g.add(hoodMesh);

  // ── MUQARNAS HALF-DOME (corbelled stalactite vault) ──────────────
  // The 3D read comes from GEOMETRY, not a 2-tone checker: every cell soffit tilts
  // down-and-forward so the directional key rakes across the fan as a real gradient;
  // rows brick-stagger and corbel forward harder; the palette stays one warm family
  // (lit soffit / deep warm pocket) with a sparse gold accent. Cells are binned by
  // material and merged → ~3 draws instead of ~24.
  const muqApexY   = apex - (apex - spring) * 0.06;   // top of the cluster (near apex)
  const muqBaseY   = spring + (apex - spring) * 0.30; // bottom of the cluster
  const muqBackZ   = backZ + (frontZ - backZ) * 0.22; // start nearer mid-iwan so it catches light
  const muqLitGeos:    THREE.BufferGeometry[] = [];   // lit forward soffits
  const muqPocketGeos: THREE.BufferGeometry[] = [];   // deep warm pockets
  const muqAccentGeos: THREE.BufferGeometry[] = [];   // sparse gold accent cells
  const _mm = new THREE.Matrix4();
  const ROWS = 7;
  for (let row = 0; row < ROWS; row++) {
    const tg = row / (ROWS - 1);                       // 0 at bottom, 1 at top
    const yC = muqBaseY + (muqApexY - muqBaseY) * tg;
    const rowH = (muqApexY - muqBaseY) / ROWS * 1.15;
    const env = Math.cos(tg * Math.PI * 0.42);         // 1 at base → ~0.7 at top
    const rowW = aw * 0.92 * env;
    const zC = muqBackZ + (frontZ - backZ) * 0.30 * tg; // corbel forward harder (was 0.16)
    const cells = Math.max(2, Math.round(7 * env));
    const cellW = rowW / cells;
    const stagger = (row % 2) ? cellW * 0.5 : 0;       // brick-nest alternate rows
    for (let ci = 0; ci < cells; ci++) {
      const bx = -rowW / 2 + (ci + 0.5) * cellW + stagger;
      if (bx + cellW / 2 > rowW / 2 + 0.01) continue;  // keep the stagger inside the envelope
      const fwd = (ci + row) % 2 === 0;
      const cellD = fwd ? rowH * 0.95 : rowH * 0.6;
      const cellGeo = new THREE.BoxGeometry(cellW * 0.86, rowH * 0.9, cellD);
      // Tilt the soffit down-and-forward, then position — light rakes the underside.
      cellGeo.applyMatrix4(_mm.makeRotationX(-0.5));
      cellGeo.applyMatrix4(_mm.makeTranslation(bx, yC, zC + cellD / 2));
      const accent = (ci + row * 2) % 5 === 0;
      (accent ? muqAccentGeos : fwd ? muqLitGeos : muqPocketGeos).push(cellGeo);
    }
  }
  const muqLitMat    = new THREE.MeshLambertMaterial({ color: C.sandLight, emissive: new THREE.Color(C.sandLight), emissiveIntensity: 0.05 });
  const muqPocketMat = mat(0x6e4f28);   // warm mid-dark pocket (not near-black)
  const muqAccentMat = new THREE.MeshLambertMaterial({ color: C.gold, emissive: new THREE.Color(C.gold), emissiveIntensity: 0.10 });
  const addMuq = (bin: THREE.BufferGeometry[], material: THREE.Material) => {
    if (!bin.length) return;
    const merged = mergeGeometries(bin, false);
    bin.forEach(b => b.dispose());
    if (merged) g.add(new THREE.Mesh(merged, material));
  };
  addMuq(muqLitGeos, muqLitMat);
  addMuq(muqPocketGeos, muqPocketMat);
  addMuq(muqAccentGeos, muqAccentMat);

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
      emissiveIntensity: 0.10,   // keep a faint lapis breath, but let the recess drop into shadow
      side: THREE.DoubleSide,
    }),
  );
  backWall.position.set(0, (apex + 0.4) / 2, backZ + 0.07);
  g.add(backWall);

  // ── PROUD PERIMETER FRAME + ARCHIVOLT (real relief, not a printed billboard) ──
  // Converts the flat textured screen into a framed portal whose edges throw shadow.
  const _fm = new THREE.Matrix4();
  const goldEdgeMat = new THREE.MeshLambertMaterial({ color: C.gold });
  const pushFrame = (bin: THREE.BufferGeometry[], bw: number, bh: number, bd: number, x: number, y: number, z: number) => {
    const gg = new THREE.BoxGeometry(bw, bh, bd);
    gg.applyMatrix4(_fm.makeTranslation(x, y, z));
    bin.push(gg);
  };
  const buildArch = (p: THREE.Shape | THREE.Path, aW: number, sp: number, ap: number, y0: number) => {
    p.moveTo(-aW / 2, y0);
    p.lineTo(-aW / 2, sp);
    p.bezierCurveTo(-aW / 2, sp + (ap - sp) * 0.55, -aW * 0.30, ap - (ap - sp) * 0.18, 0, ap);
    p.bezierCurveTo(aW * 0.30, ap - (ap - sp) * 0.18, aW / 2, sp + (ap - sp) * 0.55, aW / 2, sp);
    p.lineTo(aW / 2, y0);
    p.closePath();
  };

  // (1) Outer cobalt perimeter frame — 4 thin boxes, proud of the bosses (frontZ+0.06)
  const frameW = w * 0.10;
  const frameZ2 = frontZ + 0.12;
  const frameBins: THREE.BufferGeometry[] = [];
  pushFrame(frameBins, w + frameW, frameW, 0.12, 0, h - frameW / 2, frameZ2);  // top
  pushFrame(frameBins, w + frameW, frameW, 0.12, 0, frameW / 2, frameZ2);      // bottom
  pushFrame(frameBins, frameW, h, 0.12, -(w / 2), h / 2, frameZ2);             // left
  pushFrame(frameBins, frameW, h, 0.12,  (w / 2), h / 2, frameZ2);             // right
  const frameMerged = mergeGeometries(frameBins, false);
  frameBins.forEach(b => b.dispose());
  if (frameMerged) g.add(new THREE.Mesh(frameMerged, new THREE.MeshLambertMaterial({ color: C.cobalt })));

  // (2) Thin gold inner edge just inside the cobalt frame
  const goldBins: THREE.BufferGeometry[] = [];
  const gEdge = frameW * 0.25, gz = frontZ + 0.16;
  const innerHalfW = w / 2 - frameW;
  pushFrame(goldBins, innerHalfW * 2 + gEdge, gEdge, 0.10, 0, h - frameW - gEdge / 2, gz);  // top
  pushFrame(goldBins, innerHalfW * 2 + gEdge, gEdge, 0.10, 0, frameW + gEdge / 2, gz);      // bottom
  pushFrame(goldBins, gEdge, h - frameW * 2, 0.10, -innerHalfW, h / 2, gz);                 // left
  pushFrame(goldBins, gEdge, h - frameW * 2, 0.10,  innerHalfW, h / 2, gz);                 // right
  const goldMerged = mergeGeometries(goldBins, false);
  goldBins.forEach(b => b.dispose());
  if (goldMerged) g.add(new THREE.Mesh(goldMerged, goldEdgeMat));

  // (3) Raised archivolt ring hugging the pointed arch (turquoise + thinner gold inside)
  const ringW = w * 0.045;
  const arShape = new THREE.Shape();
  buildArch(arShape, aw + ringW * 2, spring, apex + ringW, spring - (apex - spring) * 0.5);
  const arHole = new THREE.Path();
  buildArch(arHole, aw, spring, apex, spring - (apex - spring) * 0.5);
  arShape.holes.push(arHole);
  const archRing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(arShape, { depth: 0.12, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({ color: C.turquoise, emissive: new THREE.Color(C.turquoise), emissiveIntensity: 0.10 }),
  );
  archRing.position.set(0, 0, frontZ);   // extrudes +Z → front face proud at frontZ+0.12
  g.add(archRing);
  const grShape = new THREE.Shape();
  buildArch(grShape, aw, spring, apex, spring - (apex - spring) * 0.5);
  const grHole = new THREE.Path();
  buildArch(grHole, aw - ringW * 0.7, spring, apex - ringW * 0.35, spring - (apex - spring) * 0.5);
  grShape.holes.push(grHole);
  const goldRing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(grShape, { depth: 0.10, bevelEnabled: false }),
    goldEdgeMat,
  );
  goldRing.position.set(0, 0, frontZ + 0.04);
  g.add(goldRing);

  // ── TYMPANUM TILE FRAME (the mosaic reads as inset tilework, not a hung poster) ──
  // A proud gold+cobalt rope frame in front of the back-wall mosaic gives it real
  // shadow edges so it reads as set-in tile. (Cheaper than swapping in a recessed
  // tigerSpandrel sub-panel, which is variant-specific and lives in textures.ts.)
  const tymW = aw + 0.4, tymH = apex + 0.4, tymCY = tymH / 2;
  const tymFz = backZ + 0.22, tb = w * 0.05;
  const tBins: THREE.BufferGeometry[] = [];
  pushFrame(tBins, tymW + tb, tb, 0.10, 0, tymCY + tymH / 2, tymFz);  // top
  pushFrame(tBins, tymW + tb, tb, 0.10, 0, tymCY - tymH / 2, tymFz);  // bottom
  pushFrame(tBins, tb, tymH, 0.10, -tymW / 2, tymCY, tymFz);          // left
  pushFrame(tBins, tb, tymH, 0.10,  tymW / 2, tymCY, tymFz);          // right
  const tMerged = mergeGeometries(tBins, false);
  tBins.forEach(b => b.dispose());
  if (tMerged) g.add(new THREE.Mesh(tMerged, new THREE.MeshLambertMaterial({ color: C.cobalt })));
  const tg2: THREE.BufferGeometry[] = [];
  const tgi = tb * 0.3;
  pushFrame(tg2, tymW, tgi, 0.08, 0, tymCY + tymH / 2 - tb * 0.5, tymFz + 0.04);
  pushFrame(tg2, tymW, tgi, 0.08, 0, tymCY - tymH / 2 + tb * 0.5, tymFz + 0.04);
  pushFrame(tg2, tgi, tymH - tb, 0.08, -tymW / 2 + tb * 0.5, tymCY, tymFz + 0.04);
  pushFrame(tg2, tgi, tymH - tb, 0.08,  tymW / 2 - tb * 0.5, tymCY, tymFz + 0.04);
  const tgMerged = mergeGeometries(tg2, false);
  tg2.forEach(b => b.dispose());
  if (tgMerged) g.add(new THREE.Mesh(tgMerged, goldEdgeMat));

  // ── WARM IWAN FILL LIGHT (one per grand portal) ──────────────────
  // Lifts the deep recess + muqarnas which the directional sun barely reaches.
  // castShadow MUST stay false: the shadow map is frozen and a shadow-casting
  // point light would break it. Distance-bounded → cheap on the Lambert materials.
  const iwanLight = new THREE.PointLight(0xffb060, 8, iwanDepth * 2, 2);
  iwanLight.position.set(0, spring, backZ + 1);
  iwanLight.castShadow = false;
  g.add(iwanLight);

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
  // Saturated cobalt-teal valley (not muddy-dark) + a crisp, brighter-but-not-pastel ridge.
  // Phong (finding 1) now supplies the sun-side glint, so the painted ridge stays restrained.
  const valleyCol = glazeCol.clone().lerp(new THREE.Color(C.lapis), 0.30).multiplyScalar(0.55);
  const valleyHex = '#' + valleyCol.getHexString();
  const ridgeHex  = '#' + glazeCol.clone().lerp(new THREE.Color(0xffffff), 0.22).getHexString();
  const baseHex   = '#' + glazeCol.getHexString();
  // Deep teal-blue belly for the smooth-cap vertical gradient.
  const deepBellyHex = '#' + glazeCol.clone().lerp(new THREE.Color(C.lapis), 0.30).multiplyScalar(0.85).getHexString();

  // ── TALL INSCRIPTION DRUM ────────────────────────────────────────
  // Refs (every Registan dome) show a tall cylindrical drum carrying a grand
  // kufic inscription band, crowned by an arcaded gallery of small arched niches.
  const drumH = r * 1.45;             // tall inscription drum — the dominant vertical (de-balloons the bulb)
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

  // ── LANTERN-NICHE BAND (continuous corbel) ────────────────────────
  // ONE short cylinder carrying a blind-arch niche texture reads as a continuous
  // corbel band, instead of ~24-32 loose niche cubes that looked like floating boxes
  // (and cuts the draw calls / sub-pixel proud plates).
  const nicheBaseY = collarY + collarH;        // y just above collar
  const nicheH     = r * 0.16;
  const nicheTex   = archPanel(512, 128);
  nicheTex.wrapS = THREE.RepeatWrapping;
  nicheTex.repeat.set(ribbed ? 16 : 12, 1);
  const nicheBand = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR * 1.05, drumR * 1.05, nicheH, 28),
    new THREE.MeshLambertMaterial({ map: nicheTex }),
  );
  nicheBand.position.y = nicheBaseY + nicheH / 2;
  g.add(nicheBand);

  const capBase = collarY + collarH + nicheH * 0.6;  // dome sits slightly above lantern niches

  // ── SHARED ONION PROFILE ──────────────────────────────────────────
  // Piecewise-linear control points: (t, radius).
  // The bulb SPRINGS from the drum (base radius = drum top) and bulges only
  // modestly past it (belly ≈ 1.21× drum), then necks to a point — a tall onion,
  // NOT a wide canopy overhanging a thin stem (which read as a mushroom/umbrella).
  const capH = r * 1.62;  // tightened bulb so it springs vertically from the tall drum

  const CTRL: [number, number][] = [
    [0.00, drumR * 1.03], // base: seats flush on the collar top (no skirt/ledge)
    [0.12, r * 0.90],     // springs upward, near-vertical off the drum
    [0.30, r * 0.99],     // widest belly — barely exceeds the 0.86r drum (no overhang)
    [0.48, r * 0.94],     // gentle shoulder
    [0.64, r * 0.66],     // smooth neck
    [0.80, r * 0.38],     // taper toward apex
    [0.92, r * 0.15],     // rounded near-apex (non-tent)
    [1.00, r * 0.02],     // tiny non-zero apex: avoids a degenerate vertex pole whose
                          // garbage normals spike the glaze specular into an ACES magenta
                          // flare. The gold finial above covers this 0.02r flat top.
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
      const hw = sw * 0.6;   // broader lit flute face (pairs with the Phong glint)
      sg.fillStyle = ridgeHex;
      sg.fillRect(px2 - hw / 2, 0, hw, 256);
    }
    // ── VERTICAL HUE + SPRINGING AO ──────────────────────────────────
    // flipY default: canvas y=0 → v=1 = crown; y=256 → v=0 = base/belly.
    // Multiply a pale-crown → deeper-bluer-belly gradient over the stripe field.
    sg.globalCompositeOperation = 'multiply';
    const hueGrad = sg.createLinearGradient(0, 0, 0, 256);
    hueGrad.addColorStop(0, '#ffffff');   // crown: unchanged
    hueGrad.addColorStop(1, '#9fd0d0');   // belly: slightly darker/bluer
    sg.fillStyle = hueGrad;
    sg.fillRect(0, 0, 512, 256);
    // Dark AO band where the bulb springs from the collar (base = canvas bottom).
    sg.fillStyle = `rgba(${valleyCol.r*255|0},${valleyCol.g*255|0},${valleyCol.b*255|0},0.5)`;
    sg.fillRect(0, 200, 512, 56);
    sg.globalCompositeOperation = 'source-over';
    // Soften stripe convergence at the apex (canvas top).
    const apexFade = sg.createLinearGradient(0, 0, 0, 36);
    apexFade.addColorStop(0, baseHex);
    apexFade.addColorStop(1, `rgba(${glazeCol.r*255|0},${glazeCol.g*255|0},${glazeCol.b*255|0},0)`);
    sg.fillStyle = apexFade;
    sg.fillRect(0, 0, 512, 36);

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

    const cap = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      map: stripeTex,
      emissive: glazeCol,
      emissiveIntensity: 0.05,
      specular: new THREE.Color(0x7fa9af),  // soft cyan-grey glaze sheen (dimmed: no bloom-flare)
      shininess: 34,
    }));
    cap.position.y = capBase;
    g.add(cap);

    // Gold finial sphere + crescent
    const finialBase = capBase + capH + r * 0.06;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 16, 12), goldShiny);
    finial.position.y = finialBase;
    g.add(finial);
    // Crescent: two overlapping spheres (outer minus inner) approximated
    // by a torus-arc-like curved ring of small boxes
    const crescentR = r * 0.055;
    const crescentY = finialBase + r * 0.10;
    const crescentMat = goldShiny;
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

    // Vertical glaze gradient: deep teal-blue belly → full glaze → pale crown.
    // LatheGeometry v runs base→apex; flipY default → canvas y=0(top)=apex, y=128=base.
    const grCanvas = document.createElement('canvas');
    grCanvas.width = 4; grCanvas.height = 128;
    const cg = grCanvas.getContext('2d')!;
    const grad = cg.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.00, ridgeHex);      // apex/crown — pale
    grad.addColorStop(0.35, baseHex);       // upper belly — full glaze
    grad.addColorStop(0.70, baseHex);       // belly — full glaze
    grad.addColorStop(1.00, deepBellyHex);  // base/spring — deep teal-blue
    cg.fillStyle = grad;
    cg.fillRect(0, 0, 4, 128);
    const grTex = new THREE.CanvasTexture(grCanvas);
    grTex.colorSpace = THREE.SRGBColorSpace;
    grTex.wrapS = grTex.wrapT = THREE.ClampToEdgeWrapping;

    const cap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 40), new THREE.MeshPhongMaterial({
      map: grTex,
      emissive: glazeCol,
      emissiveIntensity: 0.06,
      specular: new THREE.Color(0x7fa9af),  // soft cyan-grey glaze sheen (dimmed: no bloom-flare)
      shininess: 38,
    }));
    cap.position.y = capBase;
    g.add(cap);

    // Gold finial sphere + crescent for smooth dome too
    const finialBase = capBase + capH + r * 0.06;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 16, 12), goldShiny);
    finial.position.y = finialBase;
    g.add(finial);
    // Crescent for smooth dome (slightly larger)
    const crescentR2 = r * 0.07;
    const crescentY2 = finialBase + r * 0.12;
    const crescentMat2 = goldShiny;
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

/** Single tapered minaret tower: bannai shaft, corbelled muqarnas balcony, open
 *  lantern colonnade, glazed turquoise onion cap and a gold finial spike. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // ── SHAFT (tapered, spiral banna'i + kufic collars) ──────────────
  const shaftTex = minaretShaft();
  shaftTex.repeat.set(1, Math.max(1, Math.round(h / 8)));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const rBase = h * 0.060; // slimmer shaft — towers read slender like the refs
  const rTop  = h * 0.044; // gentle taper to the gallery
  const shaftH = h * 0.88;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBase, shaftH, 20), shaftMat);
  shaft.position.y = shaftH / 2;
  g.add(shaft);

  // Single continuous tapering tower — the mid-shaft balcony (sharafa) was
  // removed so the minaret reads as ONE tower, not two stacked cylinders.

  // ── CROWN: corbelled muqarnas balcony + open lantern colonnade + onion cap + finial ──
  // Every same-material part is binned and merged so the rich crown stays ~5 draw calls
  // (CREAM corbel/rings/dentils/columns/abacus = 1, textured core = 1, turquoise cap = 1,
  // gold finial = 1) — same budget as the old flat crown.
  const corniceBase = shaftH;
  const _cm = new THREE.Matrix4();
  const creamGeos: THREE.BufferGeometry[] = [];
  const pushCream = (geo: THREE.BufferGeometry, y: number) => {
    geo.applyMatrix4(_cm.makeTranslation(0, y, 0));
    creamGeos.push(geo);
  };
  let cy = corniceBase;   // running y as crown elements stack upward

  // (a) Corbel splay — inverted frustum flaring outward as it rises (muqarnas underbelly)
  const corbelH = h * 0.05;
  pushCream(new THREE.CylinderGeometry(rTop * 1.7, rTop * 1.0, corbelH, 16), cy + corbelH / 2);
  cy += corbelH;

  // (b) Three cornice rings, strong flare — the projecting balcony lip
  const ringRs = [rTop * 1.25, rTop * 1.55, rTop * 1.85];
  const ringHs = [h * 0.018, h * 0.022, h * 0.026];
  for (let i = 0; i < 3; i++) {
    pushCream(new THREE.CylinderGeometry(ringRs[i], ringRs[i] * 0.96, ringHs[i], 16), cy + ringHs[i] / 2);
    cy += ringHs[i];
  }

  // (c) Dentil ring — tiny stalactite brackets just under the balcony lip
  const dentilR = rTop * 1.5, dentilN = 16, dentilH = h * 0.02;
  for (let dN = 0; dN < dentilN; dN++) {
    const a = (dN / dentilN) * Math.PI * 2;
    const db = new THREE.BoxGeometry(rTop * 0.12, dentilH, rTop * 0.12);
    db.applyMatrix4(_cm.makeTranslation(Math.cos(a) * dentilR, cy + dentilH / 2, Math.sin(a) * dentilR));
    creamGeos.push(db);
  }
  cy += dentilH;

  // (d) Balcony floor disc — the projecting walkway silhouette
  const floorH = h * 0.018;
  pushCream(new THREE.CylinderGeometry(rTop * 1.75, rTop * 1.75, floorH, 24), cy + floorH / 2);
  cy += floorH;
  const balconyY = cy;

  // (e) Open lantern: slim textured core (dark behind the colonnade) + cream column ring
  const lanternH = h * 0.10;
  const coreR = rTop * 0.7;
  const lanternTex = archPanel(256, 128);
  lanternTex.wrapS = THREE.RepeatWrapping;
  lanternTex.repeat.set(4, 1);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(coreR, coreR, lanternH, 16),
    new THREE.MeshLambertMaterial({ map: lanternTex }),
  );
  core.position.y = balconyY + lanternH / 2;
  core.castShadow = true;
  g.add(core);

  // Column ring — slender cream columns; the gaps read as the open gallery against the sky
  const colN = 10, colRingR = rTop * 1.35, colR2 = rTop * 0.10;
  for (let c = 0; c < colN; c++) {
    const a = (c / colN) * Math.PI * 2;
    const cgeo = new THREE.CylinderGeometry(colR2, colR2, lanternH, 6);
    cgeo.applyMatrix4(_cm.makeTranslation(Math.cos(a) * colRingR, balconyY + lanternH / 2, Math.sin(a) * colRingR));
    creamGeos.push(cgeo);
  }
  // Abacus disc the cap dome seats on
  const abacusH = h * 0.015;
  pushCream(new THREE.CylinderGeometry(rTop * 1.45, rTop * 1.45, abacusH, 24), balconyY + lanternH + abacusH / 2);
  const capSeat = balconyY + lanternH + abacusH;

  // Merge the whole cream crown into ONE mesh
  const creamMerged = mergeGeometries(creamGeos, false);
  creamGeos.forEach(b => b.dispose());
  if (creamMerged) {
    const creamMesh = new THREE.Mesh(creamMerged, mat(C.cream));
    creamMesh.castShadow = true;
    g.add(creamMesh);
  }

  // (f) Glazed turquoise onion cap — the defining crown silhouette
  const capR = rTop * 1.2;
  const capDomeH = rTop * 1.6;
  const capPts: THREE.Vector2[] = [
    new THREE.Vector2(rTop * 1.0, 0),
    new THREE.Vector2(capR, capDomeH * 0.28),
    new THREE.Vector2(capR * 0.82, capDomeH * 0.62),
    new THREE.Vector2(capR * 0.42, capDomeH * 0.88),
    new THREE.Vector2(0, capDomeH),
  ];
  const capMesh = new THREE.Mesh(
    new THREE.LatheGeometry(capPts, 24),
    new THREE.MeshLambertMaterial({
      color: C.turquoise,
      emissive: new THREE.Color(C.turquoise),
      emissiveIntensity: 0.15,   // matches dome() so it catches UnrealBloom
    }),
  );
  capMesh.position.y = capSeat;
  capMesh.castShadow = true;
  g.add(capMesh);

  // (g) Gold finial spike: cone + sphere merged into one gold mesh
  const finialGeos: THREE.BufferGeometry[] = [];
  const coneGeo = new THREE.ConeGeometry(rTop * 0.18, rTop * 0.9, 8);
  coneGeo.applyMatrix4(_cm.makeTranslation(0, capSeat + capDomeH + rTop * 0.45, 0));
  finialGeos.push(coneGeo);
  const knobGeo = new THREE.SphereGeometry(rTop * 0.16, 8, 8);
  knobGeo.applyMatrix4(_cm.makeTranslation(0, capSeat + capDomeH + rTop * 1.0, 0));
  finialGeos.push(knobGeo);
  const finialMerged = mergeGeometries(finialGeos, false);
  finialGeos.forEach(b => b.dispose());
  if (finialMerged) {
    const fm = new THREE.Mesh(finialMerged, goldShiny);
    fm.castShadow = true;
    g.add(fm);
  }

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
const _archSoffitMat = new THREE.MeshLambertMaterial({ color: 0x4a3622 }); // lifted from 0x2a1d10 so deep niches read shadowed-but-lit, not as black holes
// Shared hujra-detail materials (one instance reused across all 16 facades).
const _returnMat = new THREE.MeshLambertMaterial({ color: 0x52401f });       // deep-shadow reveal (lifted from 0x33240f)
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
    lanterns?: boolean;      // hang lit lanterns in the lower-storey hujra niches (default true)
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
  const RECESS_DEPTH = 0.52;            // deeper niches → arcades read more 3D (was 0.34)
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

  // Niche back wall — a DARK WARM BROWN (deep brick shadow), not pure black, so
  // the recesses read as shadowed arched niches like the photos, not flat voids.
  // DoubleSide so it renders regardless of which way the Group is rotated (courtyard vs plaza).
  const backWallColor = 0x2a2016;  // dark warm brown — deep recess shadow
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
  const lanternSites: LanternSite[] = [];   // lower-storey niche centres → hanging lanterns

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

      // Lower storey only: record a lantern site hanging inside the arch opening.
      if (s === STORIES - 1) {
        lanternSites.push({ x: cxLocal, y: sBaseY + storyH * 0.50, z: BACK_Z + 0.26 });
      }

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

  // ── HANGING LANTERNS (warm lit niches) ───────────────────────────
  if ((opts.lanterns ?? true) && lanternSites.length) {
    const lanternScale = Math.min(1.25, Math.max(0.7, (len / bays) / 3.0));
    g.add(lanternRow(lanternSites, BACK_Z, lanternScale));
  }

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
