import * as THREE from 'three';
import { C } from '../palette';
import { girih, bannai, meander, calligraphyBand, archPanel, tigerSpandrel, pylonFace } from '../patterns/textures';
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
    const PATTERN_WORLD = 10.0; // one bannai tile = 10 world units (4 diamonds/tile → ~2.5 wu/diamond — large geometry like refs)
    // Clamp to at least 0.5 repeats so shallow faces don't show stretched blobs
    t.repeat.set(Math.max(0.5, worldW / PATTERN_WORLD), Math.max(0.5, worldH / PATTERN_WORLD));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
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

function archShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape(); const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(-r, h - r);
  s.quadraticCurveTo(-r, h - r * 0.1, 0, h);       // slightly pointed Persian arch
  s.quadraticCurveTo(r, h - r * 0.1, r, h - r);
  s.lineTo(r, 0); s.closePath();
  return s;
}

/**
 * Monumental portal with anatomically-correct parts:
 *   - Two flanking PYLON boxes (bannai-patterned)
 *   - LINTEL box bridging top (girih front + calligraphy band)
 *   - IWAN: floor + back wall (girih dark) + two side walls + deep-shadow arch face
 *   - ARCH TRIM: cream/gold extruded annular ring following pointed arch edge
 *   - SPANDREL panels: 'tigers' → twin mirrored tigerSpandrel planes; else girih
 *   - CALLIGRAPHY BAND: proud plane at very top of lintel
 *
 * opts.decals = 'tigers' → Sher-Dor twin mirrored tiger spandrels
 */
export function pishtaq(
  w: number, h: number, d: number,
  opts: { decals?: 'tigers' } = {},
): THREE.Group {
  const g = new THREE.Group();

  // Proportions
  const pylonW    = w * 0.20;        // border frame width (~20% each side — matches real proportions)
  const iwanW     = w - pylonW * 2;  // clear arch opening width
  const iwanH     = h * 0.78;        // height of arch opening
  const iwanDepth = Math.min(d * 0.85, 4.5); // recess depth (inward, away from plaza)

  const frontZ = d / 2;              // portal front face z (local)
  const backZ  = frontZ - iwanDepth; // iwan back wall z (local)

  const bannaiTex = bannai(C.sand, C.cream, C.cobalt);
  // Dense pylon-face texture: tighter grid + 8-pt stars + kufic border strips
  const pylonTex = pylonFace(C.sand, C.cobalt, C.turquoise, C.cobalt);

  // ── LEFT & RIGHT PYLONS ─────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const pylon = patternedBoxMulti(pylonW, h, d, C.sand, {
      pz: pylonTex,   // front face — the most visible — dense pylon tilework
      nz: bannaiTex,
      px: pylonTex,   // outer side face (visible from sides)
      nx: pylonTex,   // inner side face (visible from inside iwan recess)
    });
    pylon.position.x = sx * (iwanW / 2 + pylonW / 2);
    // patternedBoxMulti auto-sets y = h/2 internally
    g.add(pylon);
  }

  // ── LINTEL ──────────────────────────────────────────────────────
  const lintelH = h - iwanH;
  const lintel = patternedBoxMulti(iwanW, lintelH, d, C.sand, {
    pz: girih(C.sand, C.cobalt, C.turquoise, 2),
    nz: bannaiTex,
    px: bannaiTex,
    nx: bannaiTex,
  });
  lintel.position.set(0, iwanH + lintelH / 2, 0);
  g.add(lintel);

  // ── IWAN FLOOR ──────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, 0.12, iwanDepth),
    mat(C.sandDark),
  );
  floor.position.set(0, 0.06, frontZ - iwanDepth / 2);
  g.add(floor);

  // ── IWAN SIDE WALLS ─────────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, iwanH, iwanDepth),
      new THREE.MeshLambertMaterial({ color: 0x4a6898 }),  // shadowed blue
    );
    sw.position.set(sx * (iwanW / 2 - 0.07), iwanH / 2, frontZ - iwanDepth / 2);
    g.add(sw);
  }

  // ── IWAN BACK WALL ──────────────────────────────────────────────
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(iwanW, iwanH, 0.14),
    new THREE.MeshLambertMaterial({
      map: (() => { const t = girih(C.lapis, C.cobalt, C.turquoise, 2); t.repeat.set(0.5, 0.5); return t; })(),
      color: 0x3a587e,
      emissive: new THREE.Color(0x16396e),
      emissiveIntensity: 0.25,
    }),
  );
  backWall.position.set(0, iwanH / 2, backZ + 0.07);
  g.add(backWall);

  // Small door on back wall
  const doorW = iwanW * 0.30, doorH = iwanH * 0.35;
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    mat(0x0f1f35),
  );
  door.position.set(0, doorH / 2 + 0.01, backZ + 0.22);
  g.add(door);

  // ── IWAN VAULT (quarter-dome suggestion) ─────────────────────────
  // A shallow semi-vault surface at the top of the iwan recess, reading as a
  // coffered quarter-dome in lapis — visible inside the arch opening.
  // Geometry: lathe segment sweeping from 0 to PI (half revolution around Y),
  // then positioned at the arch crown with the profile curving inward/up.
  // The vault covers the iwan ceiling from front arch edge to back wall.
  {
    const vaultW = iwanW;
    const vaultR = vaultW / 2;  // radius of the semi-vault belly
    const vaultDepth = iwanDepth;
    const N = 24; // azimuthal subdivisions for smoothness

    // Build a half-cylinder vault surface: open half-pipe rotated so the opening
    // faces downward into the iwan. This reads as a curved vault ceiling.
    // Profile: half-circle sweeping from (0, 0) through the top (vaultR, vaultR).
    // We build it as a BufferGeometry: a grid of quads spanning U=[0,PI] (half sweep)
    // and V=[0,1] (depth, front to back).
    const RINGS_V = 12; // depth subdivisions
    const vaultPos: number[] = [];
    const vaultUVs: number[] = [];
    const vaultIdx: number[] = [];

    for (let vi = 0; vi <= RINGS_V; vi++) {
      const vt = vi / RINGS_V; // 0 = front arch edge, 1 = back
      const zPos = frontZ - vt * vaultDepth;
      for (let ui = 0; ui <= N; ui++) {
        const phi = ui / N * Math.PI; // 0..PI: left to right along half circle
        // Half-circle: x runs from -vaultR to +vaultR, y is the arc height above crown
        // Vault sits at top of iwan (iwanH), curves down from sides to centre.
        // We want the vault to be convex upward: y = iwanH + vaultR*(1 - sin(phi)) and x = vaultR*cos(PI - phi)
        // So at phi=0: x=-vaultR, y=iwanH (at left edge)
        //    at phi=PI/2: x=0, y=iwanH+vaultR (crown centre, highest)
        //    at phi=PI:  x=+vaultR, y=iwanH (right edge)
        // Wait — we want it to curve like a vault CEILING (concave from below).
        // Concave ceiling: x = vaultR * cos(phi - PI/2), y = iwanH + vaultR * sin(phi - PI/2)
        // phi=0: x = vaultR * cos(-PI/2)=0, y=iwanH + vaultR*sin(-PI/2) = iwanH - vaultR → too low
        // Better: half-dome that spans the width and sits at top.
        // Just a simple half-barrel: x goes -vaultR..+vaultR, y = iwanH + (vaultR * 0.3) * sin(phi)
        // This gives a shallow arch ceiling. vaultR*0.3 = gentle curve, not a deep half-sphere.
        const curvature = vaultR * 0.35; // shallow — just a hint, not a full hemisphere
        const x = vaultR * Math.cos(Math.PI - phi); // maps phi 0->PI to x -vaultR->+vaultR
        const y = iwanH + curvature * Math.sin(phi);
        vaultPos.push(x, y, zPos);
        vaultUVs.push(ui / N, vt);
      }
    }

    for (let vi = 0; vi < RINGS_V; vi++) {
      for (let ui = 0; ui < N; ui++) {
        const a = vi * (N + 1) + ui;
        const b = a + 1;
        const c = (vi + 1) * (N + 1) + ui;
        const dd = c + 1;
        vaultIdx.push(a, c, b, b, c, dd);
      }
    }

    const vaultGeo = new THREE.BufferGeometry();
    vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vaultPos, 3));
    vaultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(vaultUVs, 2));
    vaultGeo.setIndex(vaultIdx);
    vaultGeo.computeVertexNormals();

    // Faint girih texture on the vault surface — lapis field with cobalt pattern
    const vaultTex = girih(C.lapis, C.cobalt, C.turquoise, 2);
    vaultTex.repeat.set(1, 1);

    const vault = new THREE.Mesh(vaultGeo, new THREE.MeshLambertMaterial({
      map: vaultTex,
      color: 0x3a5878,         // shadowed lapis — reads darker than iwan back wall
      emissive: new THREE.Color(C.lapis),
      emissiveIntensity: 0.12, // just enough to hint at detail in shadow, not glow
      side: THREE.DoubleSide,  // visible looking up from below
    }));
    g.add(vault);
  }

  // ── REAR SEALING WALL ────────────────────────────────────────────
  // Solid patterned wall covering the iwan gap at the back face.
  // position.set() overrides patternedBoxMulti's internal y=h/2; we must pass
  // y = rearWallH/2 so the box bottom sits at y=0 (ground level).
  const rearWallH = iwanH; // seal from ground to lintel height
  const rearWall = patternedBoxMulti(iwanW, rearWallH, 0.24, C.sand, {
    nz: bannai(C.sand, C.cream, C.cobalt),  // exterior back face (nz = -Z face)
    pz: bannaiTex,
  });
  // z: back face of portal is at -frontZ; place centre of 0.24-thick wall there
  rearWall.position.set(0, rearWallH / 2, -(frontZ - 0.12));
  g.add(rearWall);

  // ── ARCH TRIM + FACE (two-layer technique) ─────────────────────
  // Layer 1: CREAM outer arch (slightly wider/taller) — forms the visible trim band
  // Layer 2: DARK inner arch (exact iwan size, protrudes slightly MORE forward)
  // Cream ring is visible around the dark arch edges.
  const trimW = Math.max(0.32, iwanW * 0.06);
  const archOuter  = iwanW + trimW * 2;    // outer arch width for cream layer
  const archOuterH = iwanH + trimW * 1.4;  // outer arch height for cream layer

  // Cream outer arch — Lambert with low emissive so it reads bright-but-matte without blooming
  const trimFace = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape(archOuter, archOuterH), { depth: 0.24, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({ color: C.cream, emissive: new THREE.Color(C.cream), emissiveIntensity: 0.35 }),
  );
  trimFace.position.set(0, 0, frontZ - 0.20);
  g.add(trimFace);

  // Dark inner arch — front face at frontZ + 0.06 (6cm in front of cream)
  // This ensures dark arch cleanly occludes the cream interior
  // Slight lapis emissive so arch reads as deep shadow with blue detail hint, not void.
  const archFace = new THREE.Mesh(
    new THREE.ExtrudeGeometry(archShape(iwanW, iwanH), { depth: 0.28, bevelEnabled: false }),
    new THREE.MeshLambertMaterial({
      color: 0x050e1e,
      emissive: new THREE.Color(0x16396e),
      emissiveIntensity: 0.18,
    }),
  );
  archFace.position.set(0, 0, frontZ - 0.22);
  g.add(archFace);

  // ── SPANDREL PANELS ─────────────────────────────────────────────
  // Panels sit on the PYLON FRONT FACES, flanking the arch — upper portion of pylons.
  // This matches real Timurid anatomy: tigers/girih fill the pylon spandrel zone.
  const spandrelBaseY = h * 0.35;   // start from 35% height of portal
  const spandrelTopY  = h * 0.88;   // up to 88% height
  const spandrelH2    = spandrelTopY - spandrelBaseY;
  const spandrelPylW  = pylonW * 0.86; // nearly full pylon width
  const spandrelCentX = iwanW / 2 + pylonW / 2; // center of each pylon

  if (opts.decals === 'tigers') {
    const tex = tigerSpandrel();
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelPylW, spandrelH2),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      if (sx === 1) panel.scale.x = -1;  // mirror right tiger
      panel.position.set(
        sx * spandrelCentX,
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.04,
      );
      g.add(panel);
    }
  } else {
    const spTex = girih(C.sand, C.cobalt, C.turquoise, 1);
    for (const sx of [-1, 1] as const) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spandrelPylW, spandrelH2),
        new THREE.MeshLambertMaterial({ map: spTex }),
      );
      panel.position.set(
        sx * spandrelCentX,
        spandrelBaseY + spandrelH2 / 2,
        frontZ + 0.03,
      );
      g.add(panel);
    }
  }

  // ── CALLIGRAPHY BAND ─────────────────────────────────────────────
  const bandH = h * 0.085;
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }),
  );
  band.position.set(0, h - bandH / 2 - h * 0.01, frontZ + 0.03);
  g.add(band);

  return g;
}

/** Bulbous turquoise dome on a patterned drum.
 *  ribbed=true  → melon-fluted dome (Sher-Dor style): 16 soft rounded lobes
 *                 via custom BufferGeometry with r(θ,φ) = profile(θ) * (1 + A·cos(N·φ))
 *  ribbed=false → smooth onion dome (Tilya-Kori style): tall narrow onion lathe
 */
export function dome(r: number, ribbed = false): THREE.Group {
  const g = new THREE.Group();

  // ── DRUM ─────────────────────────────────────────────────────────
  const drumH = r * 0.75;
  const drumR  = r * 0.72;
  const drumTex = calligraphyBand(C.lapis, C.cream);
  drumTex.repeat.set(Math.max(1, Math.round(drumR * 2)), 1);
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

  const capBase = collarY + collarH;

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
    // Texture: vertical dark stripes at lobe valleys make ribs visible regardless
    // of lighting (critical because hemisphere lighting washes out geometry shading).
    const LOBES = 16;
    const AMP_MAX = 0.18;  // 18% scallop — visible geometry + texture stripe combo
    const RINGS = 32;
    const SEGS  = LOBES * 8; // 128 azimuthal segs — smooth geometry

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
      const sw = 512 / LOBES * 0.28;         // stripe width: 28% of lobe pitch
      // Dark teal valley
      sg.fillStyle = '#1a8080';
      sg.fillRect(cx - sw / 2, 0, sw, 256);
      // Lighter highlight on ridge peak (halfway between valleys)
      const px2 = ((i + 1.0) / LOBES) * 512;
      const hw = sw * 0.5;
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

    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 8), mat(C.gold));
    finial.position.y = capBase + capH + r * 0.06;
    g.add(finial);

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

    const finial = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 8), mat(C.gold));
    finial.position.y = capBase + capH + r * 0.06;
    g.add(finial);
  }

  return g;
}

/** Tapered minaret with bannai shaft, corbel cornice rings, gallery, and buff dome cap. */
export function minaret(h: number): THREE.Group {
  const g = new THREE.Group();

  // ── SHAFT (tapered, bannai pattern) ──────────────────────────────
  const shaftTex = bannai(C.sand, C.cream, C.cobalt);
  shaftTex.repeat.set(1, Math.max(1, Math.round(h / 8)));
  const shaftMat = new THREE.MeshLambertMaterial({ map: shaftTex });
  const rBase = h * 0.095;  // slightly fatter base (real ones are stout)
  const rTop  = h * 0.058;  // top of shaft just below cornice
  const shaftH = h * 0.88;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBase, shaftH, 16), shaftMat);
  shaft.position.y = shaftH / 2;
  g.add(shaft);

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

  // ── DOME CAP (buff/sand sphere — NOT turquoise, refs show buff caps) ─
  const capBase = galleryBase + galleryH;
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

  let extTex: THREE.Texture;
  let innerTex: THREE.Texture;
  if (wingStyle === 'meander') {
    // SD: meander-dominant — rich cobalt/cream interlocking swastika grid
    extTex  = meander(C.cobalt, C.cream);
    innerTex = meander(C.cobalt, C.sandLight);
  } else if (wingStyle === 'arch-floral') {
    // TK: warm gold-accent field — bannai with gold motif dots instead of cobalt
    extTex  = bannai(C.sand, C.cream, C.gold);
    innerTex = bannai(C.sandLight, C.cream, C.gold);
  } else {
    // UB default: diagonal lattice with star (cobalt diamond) accents
    extTex  = bannai(C.sand, C.cream, C.cobalt);
    innerTex = bannai(C.sand, C.cream, C.sandDark);
  }

  // Wall slab: patterned on all exterior faces; arch panels placed proud on +Z front
  g.add(patternedBoxMulti(len, h, d, C.sand, {
    pz: innerTex, // front wall behind panels — subtle so arch panels pop
    px: extTex,
    nx: extTex,
    nz: extTex,  // outside back
  }));

  // Front face: two rows of framed arch panels (flat planes proud of wall)
  const n = Math.max(2, Math.floor(len / 2.6));
  const panelW = (len * 0.9) / n;
  const panelH = h * 0.42;
  const panelSpacingX = len / n;

  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < n; i++) {
      const px2 = -len / 2 + panelSpacingX * (i + 0.5);
      const py2 = s === 0 ? panelH * 0.55 : panelH * 0.55 + h * 0.46;
      // archPanel is non-tiling; generate per-panel (shared per storey to save draw calls)
      const panelTex = archPanel(Math.round(panelW * 100), Math.round(panelH * 100));
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW * 0.92, panelH * 0.9),
        new THREE.MeshLambertMaterial({ map: panelTex }),
      );
      panel.position.set(px2, py2, d / 2 + 0.02);
      g.add(panel);
    }
  }

  // Top calligraphy band
  const bandH = h * 0.10;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.96, bandH),
    new THREE.MeshLambertMaterial({ map: calligraphyBand(C.lapis, C.cream) }));
  strip.position.set(0, h - bandH / 2 - h * 0.02, d / 2 + 0.02);
  g.add(strip);

  return g;
}
