import * as THREE from 'three';
import { C } from '../palette';
import { LAYOUT } from '../world/layout';
import { textureRegistry } from '../scene/lod';

// ── Colour helpers ──────────────────────────────────────────────────────────
function hex(n: number): string { return '#' + n.toString(16).padStart(6, '0'); }

function blendHex(a: number, b: number, t: number): string {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (gg << 8) | bl).toString(16).padStart(6, '0');
}

function darken(n: number, f: number): string { return blendHex(n, 0x000000, f); }

function lightenNum(n: number, f: number): number {
  const ar = (n >> 16) & 0xff, ag = (n >> 8) & 0xff, ab = n & 0xff;
  const r = Math.round(ar + (0xff - ar) * f);
  const gg = Math.round(ag + (0xff - ag) * f);
  const bl = Math.round(ab + (0xff - ab) * f);
  return (r << 16) | (gg << 8) | bl;
}

/** Linear congruential generator — seeded, no Math.random */
function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Draw function (closure captures LAYOUT dims) ────────────────────────────

const cols = LAYOUT[0].length;
const rows = LAYOUT.length;

/** Base resolution — LOD system will scale up to 2x at high zoom */
const BASE_W = 2048;
const BASE_H = Math.ceil((BASE_W / cols) * rows);

/**
 * Full paving draw — called once at init and again by LOD registry at 2x.
 * All coords are parameterised by (w, h) so the registry can re-rasterize
 * at any scale without mutation.
 */
function drawGround(g: CanvasRenderingContext2D, w: number, h: number): void {
  const tW = w / cols;  // tile width in px
  const tH = h / rows;  // tile height in px

  // ── Palette ──────────────────────────────────────────────────────────────
  // Lift plaza colour toward white to compensate for MeshLambertMaterial attenuation.
  // The plaza must read as the LIGHTEST, warmest surface in the whole scene.
  const plazaNum = lightenNum(C.plaza, 0.44);   // ~0xf7f2ea warm cream
  const baseHex  = hex(plazaNum);

  // Flagstone: pale warm limestone tones — subtle range so the field stays bright.
  const stoneBase      = plazaNum;                      // brightest cream
  const stoneDark      = 0xe9ddc6;                       // warm buff (darker flag)
  const stoneMid       = 0xf1e8d6;                       // mid warm cream
  const stoneMortarNum = 0xcdbf9f;                       // mortar seam — warm golden taupe
  const mortarHex      = hex(stoneMortarNum);

  // Walkway: distinctly lighter near-white warm stone band (axial path).
  const walkStoneNum = lightenNum(C.marble, 0.34);    // ~0xf8f6f1 near-white warm
  const walkHex      = hex(walkStoneNum);
  const walkDarkNum  = lightenNum(C.marble, 0.16);    // slightly darker variant
  const walkDarkHex  = hex(walkDarkNum);

  // Inlay: pale warm limestone brick for herringbone borders — keeps ground light.
  // Only slightly warmer/darker than base flags, never terracotta.
  const brickDark  = 0xe4d8c0;  // warm pale buff
  const brickLight = 0xefe6d4;  // lighter pale buff
  const brickMortarHex = hex(stoneMortarNum);      // same mortar as flagstones

  // Geometric inlay ink: warm taupe, used for the radiating Registan-style line art.
  // Kept low-contrast so it is subtle at default zoom, rewarding up close.
  const inlayInk    = 0xb8a888;                       // warm taupe line
  const inlayInkHex = hex(inlayInk);
  const inlayFill   = 0xe0d4ba;                       // soft inlay fill (slightly darker buff)
  const inlayFillHex = hex(inlayFill);

  // Medallion stroke colours
  const medalStroke = darken(plazaNum, 0.26);         // warm mid-grey ink

  // ── 1. Base fill ─────────────────────────────────────────────────────────
  g.fillStyle = baseHex;
  g.fillRect(0, 0, w, h);

  // ── 2. Large limestone flagstones with per-stone tonal variation ─────────
  // Big squarish cut flags (~1.5 tiles) laid in a running-bond stagger, like the
  // pale stone of the real Registan plaza. Per-stone seam drawn with the flag so
  // every joint is crisp and never doubles up.
  const SW = tW * 1.5;   // stone width
  const SH = tH * 1.5;   // stone height (near-square cut flags)
  const stoneRng = makeLCG(0xA3B7C1);
  const seam = Math.max(1.0, tW * 0.05);

  const staggerCols = Math.ceil(w / SW) + 2;
  const staggerRows = Math.ceil(h / SH) + 1;

  for (let sr = 0; sr < staggerRows; sr++) {
    const offset = (sr % 2) * (SW * 0.5); // running-bond stagger
    for (let sc = -1; sc < staggerCols; sc++) {
      const px = sc * SW - offset;
      const py = sr * SH;
      if (px + SW < 0 || py + SH < 0 || px >= w || py >= h) continue;

      // Per-flag tone: pick a base variant then nudge brightness ±5%.
      const t = stoneRng();
      let stoneNum: number;
      if (t < 0.34) stoneNum = stoneDark;
      else if (t < 0.68) stoneNum = stoneMid;
      else stoneNum = stoneBase;
      const vary = stoneRng() * 0.10 - 0.05;
      const flagNum = vary >= 0 ? lightenNum(stoneNum, vary) : (() => {
        const a = (stoneNum >> 16) & 0xff, b = (stoneNum >> 8) & 0xff, c2 = stoneNum & 0xff;
        const f = 1 + vary;
        return ((Math.round(a * f) << 16) | (Math.round(b * f) << 8) | Math.round(c2 * f)) >>> 0;
      })();
      g.fillStyle = hex(flagNum);

      // Mortar seam: fill the seam-inset flag over the mortar-coloured base.
      const sx = px + seam;
      const sy = py + seam;
      const sW2 = SW - seam;
      const sH2 = SH - seam;
      if (sW2 <= 0 || sH2 <= 0) continue;
      g.fillRect(sx, sy, sW2, sH2);

      // Fine veining: a faint hairline curve on ~30% of flags.
      if (stoneRng() < 0.3) {
        g.save();
        g.globalAlpha = 0.05 + stoneRng() * 0.05;
        g.strokeStyle = darken(stoneNum, 0.14);
        g.lineWidth = 0.6;
        const vx0 = sx + stoneRng() * sW2 * 0.5;
        const vy0 = sy + stoneRng() * sH2 * 0.3;
        const vx1 = vx0 + (stoneRng() - 0.5) * sW2 * 0.7;
        const vy1 = sy + sH2 * (0.7 + stoneRng() * 0.3);
        g.beginPath();
        g.moveTo(vx0, vy0);
        g.bezierCurveTo(
          vx0 + (stoneRng() - 0.5) * sW2 * 0.4, vy0 + sH2 * 0.35,
          vx1 + (stoneRng() - 0.5) * sW2 * 0.4, vy0 + sH2 * 0.6,
          vx1, vy1,
        );
        g.stroke();
        g.restore();
      }

      // A soft top-left sheen on the brightest flags for a polished-stone feel.
      if (stoneNum === stoneBase && stoneRng() < 0.4) {
        g.save();
        g.globalAlpha = 0.06;
        g.fillStyle = '#ffffff';
        g.fillRect(sx, sy, sW2 * 0.55, sH2 * 0.5);
        g.restore();
      }
    }
  }

  // ── 3. Mortar base bleed-through ──────────────────────────────────────────
  // The seam between flags is the mortar base showing through. We laid flags
  // inset by `seam` over the cream base; paint a faint mortar wash in the seams
  // by drawing the grid lines lightly (the flags already cover the interiors).
  g.save();
  g.strokeStyle = mortarHex;
  g.lineWidth = seam;
  g.globalAlpha = 0.42;
  for (let sr = 0; sr <= staggerRows; sr++) {
    const y = sr * SH - seam * 0.5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  for (let sr = 0; sr < staggerRows; sr++) {
    const offset = (sr % 2) * (SW * 0.5);
    const y0 = sr * SH;
    const y1 = y0 + SH;
    for (let sc = -1; sc <= staggerCols; sc++) {
      const x = sc * SW - offset - seam * 0.5;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    }
  }
  g.restore();

  // ── 4. Blocked footprint darkening ────────────────────────────────────────
  const blockedFill = darken(plazaNum, 0.07);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((LAYOUT[r]?.[c] ?? '#') === '#') {
        g.fillStyle = blockedFill;
        g.fillRect(c * tW, r * tH, tW, tH);
      }
    }
  }

  // South entrance column: find the 'S' tile (shared by lattice + walkway)
  let southCol = 13; // default from layout
  for (let c = 0; c < cols; c++) {
    if (LAYOUT[19]?.[c] === 'S') { southCol = c; break; }
  }
  // Walkway: 3 tiles wide, centered on southCol
  const walkLeft   = (southCol - 1) * tW;
  const walkRight  = (southCol + 2) * tW;
  const walkWidth  = walkRight - walkLeft;

  // Open walkable plaza bounds (tiles). Used to clip the geometric inlay so it
  // never draws under building footprints.
  const openL = tW * 3.2, openR = w - tW * 3.2;
  const openT = tH * 3.2, openB = tH * 19.2;

  // ── 4b. Radiating geometric inlay lattice (the Registan signature) ─────────
  // A subtle diamond-grid of interlaced lines + small star nodes across the open
  // plaza, echoing the inlaid stone of the real square. Low contrast: barely
  // there at default zoom, crisp and rewarding up close. Drawn UNDER the walkway
  // so the lighter axial path reads on top.
  {
    g.save();
    g.beginPath();
    g.rect(openL, openT, openR - openL, openB - openT);
    g.clip();

    // Cell size of the diamond lattice (≈ 4 tiles → large stately pattern)
    const cell = tW * 4;
    const cxC = w / 2, cyC = h / 2;

    // Diagonal lattice lines (two families at ±45°) → diamond/cross grid.
    g.strokeStyle = inlayInkHex;
    g.lineWidth = Math.max(0.9, tW * 0.035);
    g.globalAlpha = 0.16;
    const diag = openR - openL + (openB - openT);
    for (let d = -diag; d < diag; d += cell) {
      // family A: y = x + k
      g.beginPath(); g.moveTo(openL, openT + (d)); g.lineTo(openR, openT + d + (openR - openL)); g.stroke();
      // family B: y = -x + k
      g.beginPath(); g.moveTo(openL, openB - (d)); g.lineTo(openR, openB - d - (openR - openL)); g.stroke();
    }

    // Small interlace star node at each lattice intersection (grid of `cell`).
    g.globalAlpha = 0.2;
    const nodeR = cell * 0.16;
    for (let gx = cxC - Math.ceil((cxC - openL) / cell) * cell; gx < openR + cell; gx += cell) {
      for (let gy = cyC - Math.ceil((cyC - openT) / cell) * cell; gy < openB + cell; gy += cell) {
        if (gx < openL - cell || gy < openT - cell) continue;
        drawInlayStarNode(g, gx, gy, nodeR, inlayInkHex, inlayFillHex);
      }
    }
    g.restore();
  }

  // ── 5. Central axial walkway — the lightest band of all ───────────────────
  // Runs the full depth of the plaza. Fill the open span; the lattice/flagstones
  // remain under the building footprint rows.
  const wCenter = (walkLeft + walkRight) / 2;
  g.save();
  g.globalAlpha = 1;
  g.fillStyle = walkHex;
  g.fillRect(walkLeft, 0, walkWidth, h);

  // Crisp twin edge bands (a darker kerb then a thin shadow line) so the path
  // reads as a raised marble runner.
  g.strokeStyle = walkDarkHex;
  g.lineWidth = Math.max(2, tW * 0.09);
  g.beginPath(); g.moveTo(walkLeft + g.lineWidth * 0.5, 0); g.lineTo(walkLeft + g.lineWidth * 0.5, h); g.stroke();
  g.beginPath(); g.moveTo(walkRight - g.lineWidth * 0.5, 0); g.lineTo(walkRight - g.lineWidth * 0.5, h); g.stroke();
  g.strokeStyle = mortarHex;
  g.lineWidth = Math.max(1, tW * 0.04);
  g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(walkLeft, 0); g.lineTo(walkLeft, h); g.stroke();
  g.beginPath(); g.moveTo(walkRight, 0); g.lineTo(walkRight, h); g.stroke();
  g.restore();

  // Walkway paving joints: regular cross-slabs + alternating centre split.
  {
    const jointRng = makeLCG(0xF2D1A0);
    g.save();
    g.globalAlpha = 0.3;
    g.strokeStyle = mortarHex;
    g.lineWidth = Math.max(1, tW * 0.04);
    for (let jy = SH; jy < h; jy += SH) {
      g.beginPath(); g.moveTo(walkLeft, jy); g.lineTo(walkRight, jy); g.stroke();
    }
    for (let jy = 0; jy < h; jy += SH) {
      if (jointRng() > 0.5) {
        g.beginPath(); g.moveTo(wCenter, jy); g.lineTo(wCenter, jy + SH); g.stroke();
      }
    }
    g.restore();
  }

  // ── 6. Star/cross medallion runner down the walkway ───────────────────────
  // A spine of geometric inlay medallions, only within the open plaza depth so
  // none land under the south gate footprint.
  const walkCenterX = wCenter;
  const inlaySpacing = tH * 3.4;
  const inlayRadius = walkWidth * 0.33;
  for (let y = tH * 4.5; y < tH * 18.5; y += inlaySpacing) {
    drawStarCrossMedallion(g, walkCenterX, y, inlayRadius, medalStroke, walkDarkHex, 0.7);
  }

  // ── 7. Herringbone brick border edging walkway ────────────────────────────
  const brickW = tW * 0.7;
  const brickH = tW * 0.35;
  const borderBandW = tW * 0.9; // narrow border strip beside walkway
  // Walkway borders only within the open plaza area (rows 3-19)
  const plazaTop = tH * 3, plazaBot = tH * 19;
  drawHerringboneBorder(g, walkLeft - borderBandW, plazaTop, borderBandW, plazaBot - plazaTop, brickW, brickH, brickDark, brickLight, brickMortarHex, 0.75);
  drawHerringboneBorder(g, walkRight, plazaTop, borderBandW, plazaBot - plazaTop, brickW, brickH, brickDark, brickLight, brickMortarHex, 0.75);

  // ── 8. Perimeter herringbone brick border ─────────────────────────────────
  // Narrower bands along open plaza edges only — much more subtle
  const perimBandW = tW * 0.85;
  const bW2 = tW * 0.55, bH2 = tW * 0.28;
  // Only draw on open (walkable) plaza perimeter — avoid building footprint zones
  drawHerringboneBorder(g, tW * 3, plazaTop, perimBandW, plazaBot - plazaTop, bW2, bH2, brickDark, brickLight, brickMortarHex, 0.65);
  drawHerringboneBorder(g, w - tW * 3 - perimBandW, plazaTop, perimBandW, plazaBot - plazaTop, bW2, bH2, brickDark, brickLight, brickMortarHex, 0.65);
  // Top and bottom open-plaza horizontal borders
  drawHerringboneBorder(g, tW * 3, plazaTop, (walkLeft - tW * 3 - borderBandW), perimBandW * 0.9, bH2, bW2, brickDark, brickLight, brickMortarHex, 0.65);
  drawHerringboneBorder(g, walkRight + borderBandW, plazaTop, (w - tW * 3 - walkRight - borderBandW), perimBandW * 0.9, bH2, bW2, brickDark, brickLight, brickMortarHex, 0.65);
  // Bottom row border
  drawHerringboneBorder(g, tW * 3, plazaBot - perimBandW * 0.9, (walkLeft - tW * 3 - borderBandW), perimBandW * 0.9, bH2, bW2, brickDark, brickLight, brickMortarHex, 0.65);
  drawHerringboneBorder(g, walkRight + borderBandW, plazaBot - perimBandW * 0.9, (w - tW * 3 - walkRight - borderBandW), perimBandW * 0.9, bH2, bW2, brickDark, brickLight, brickMortarHex, 0.65);

  // ── 9. Marble inlay roundel medallions ────────────────────────────────────
  // A few elegant roundels — four flanking the walkway in the open plaza, none
  // under the buildings. Subtle floor art, warm and light.
  const medalPositions: [number, number][] = [
    [6.5,  7.0],
    [6.5,  13.0],
    [21.5, 7.0],
    [21.5, 13.0],
  ];
  const medalRadius = tW * 2.3;
  for (const [mc, mr] of medalPositions) {
    drawRoundelMedallion(g, mc * tW, mr * tH, medalRadius, medalStroke, baseHex, walkHex);
  }

  // ── 10. Sand/dust drift weathering near edges & building bases ────────────
  {
    const dustRng = makeLCG(0xC3D9E4);
    const dustColor = darken(plazaNum, 0.04);
    const driftAlpha = 0.18;

    g.save();
    // Bottom edge dust drift
    const dustGradBottom = g.createLinearGradient(0, h - tH * 3, 0, h);
    dustGradBottom.addColorStop(0, 'rgba(0,0,0,0)');
    dustGradBottom.addColorStop(1, dustColor + '44');
    g.fillStyle = dustGradBottom;
    g.globalAlpha = driftAlpha * 1.5;
    g.fillRect(0, h - tH * 3, w, tH * 3);

    // Top edge dust
    const dustGradTop = g.createLinearGradient(0, 0, 0, tH * 2.5);
    dustGradTop.addColorStop(0, dustColor + '44');
    dustGradTop.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dustGradTop;
    g.fillRect(0, 0, w, tH * 2.5);

    // Left/right edge dust
    const dustGradLeft = g.createLinearGradient(0, 0, tW * 2, 0);
    dustGradLeft.addColorStop(0, dustColor + '44');
    dustGradLeft.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dustGradLeft;
    g.fillRect(0, 0, tW * 2, h);

    const dustGradRight = g.createLinearGradient(w - tW * 2, 0, w, 0);
    dustGradRight.addColorStop(0, 'rgba(0,0,0,0)');
    dustGradRight.addColorStop(1, dustColor + '44');
    g.fillStyle = dustGradRight;
    g.fillRect(w - tW * 2, 0, tW * 2, h);

    // Scattered dust patches near building footprints (sparse ellipses)
    g.globalAlpha = 0.07;
    for (let i = 0; i < 18; i++) {
      const dx = dustRng() * w;
      const dy = dustRng() * h;
      const drx = tW * (0.8 + dustRng() * 1.6);
      const dry = tH * (0.5 + dustRng() * 0.9);
      const grad = g.createRadialGradient(dx, dy, 0, dx, dy, drx);
      grad.addColorStop(0, hex(lightenNum(0xd8c8a4, 0.12)));  // warm sand wash
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(dx, dy, drx, dry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // ── 11. Final vignette to push warmth to the centre ──────────────────────
  {
    const vigRad = Math.max(w, h) * 0.7;
    const vig = g.createRadialGradient(w / 2, h / 2, vigRad * 0.3, w / 2, h / 2, vigRad);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(30,15,0,0.09)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  }
}

// ── Sub-draw helpers ─────────────────────────────────────────────────────────

/** Small 8-point star node for the plaza lattice intersections.
 *  Filled soft buff + thin ink outline. Caller sets globalAlpha. */
function drawInlayStarNode(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  inkHex: string, fillHex: string,
): void {
  const pts = 8;
  g.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.46;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = fillHex;
  g.fill();
  g.lineWidth = Math.max(0.6, r * 0.12);
  g.strokeStyle = inkHex;
  g.stroke();
}

/** Herringbone basket-weave brick border strip.
 *  Fills rect (x,y,bw,bh) with diagonal herringbone brick pattern. */
function drawHerringboneBorder(
  g: CanvasRenderingContext2D,
  x: number, y: number, bw: number, bh: number,
  brickW: number, brickH: number,
  darkColor: number, lightColor: number,
  mortarHex: string,
  alpha = 1.0,
): void {
  g.save();
  g.globalAlpha = alpha;
  g.beginPath();
  g.rect(x, y, bw, bh);
  g.clip();

  const rng = makeLCG((Math.round(x * 7 + y * 13) >>> 0) | 1);
  // Draw herringbone: alternating horizontal and vertical bricks in 2×2 groups
  const unitW = brickW * 2;
  const unitH = brickH * 2;

  const startX = Math.floor(x / unitW) * unitW;
  const startY = Math.floor(y / unitH) * unitH;

  for (let cy = startY - unitH; cy < y + bh + unitH; cy += unitH) {
    for (let cx = startX - unitW; cx < x + bw + unitW; cx += unitW) {
      // Vary brick color slightly
      const col = rng() > 0.5 ? darkColor : lightColor;
      const vary = rng() * 0.06 - 0.03;
      const brickHex = vary >= 0 ? hex(lightenNum(col, vary)) : darken(col, -vary);

      g.fillStyle = brickHex;
      // Top-left pair: two horizontal bricks stacked
      g.fillRect(cx + 1, cy + 1, brickW - 1, brickH - 1);
      g.fillRect(cx + 1, cy + brickH + 1, brickW - 1, brickH - 1);

      const col2 = rng() > 0.5 ? darkColor : lightColor;
      const vary2 = rng() * 0.06 - 0.03;
      g.fillStyle = vary2 >= 0 ? hex(lightenNum(col2, vary2)) : darken(col2, -vary2);
      // Top-right pair: two vertical bricks side by side
      g.fillRect(cx + brickW + 1, cy + 1, brickH - 1, brickW - 1);
      g.fillRect(cx + brickW + brickH + 1, cy + 1, brickH - 1, brickW - 1);
    }
  }

  // Mortar lines over bricks
  g.strokeStyle = mortarHex;
  g.lineWidth = 1;
  g.globalAlpha = 0.5;
  for (let cy = startY - unitH; cy < y + bh + unitH; cy += unitH) {
    g.beginPath(); g.moveTo(x, cy); g.lineTo(x + bw, cy); g.stroke();
    g.beginPath(); g.moveTo(x, cy + brickH); g.lineTo(x + bw, cy + brickH); g.stroke();
    g.beginPath(); g.moveTo(x, cy + unitH); g.lineTo(x + bw, cy + unitH); g.stroke();
  }
  for (let cx = startX - unitW; cx < x + bw + unitW; cx += unitW) {
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, y + bh); g.stroke();
    g.beginPath(); g.moveTo(cx + brickW, y); g.lineTo(cx + brickW, y + bh); g.stroke();
    g.beginPath(); g.moveTo(cx + unitW, y); g.lineTo(cx + unitW, y + bh); g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
}

/** Draw an interlaced 8-point star medallion at (cx,cy) radius r — the classic
 *  girih motif: two overlaid squares forming an 8-point star, ringed, with a
 *  filled core. `fillColor` lightly tints the star; `strokeColor` is the ink. */
function drawStarCrossMedallion(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  strokeColor: string, fillColor: string, alpha: number,
): void {
  g.save();
  g.lineJoin = 'round';

  // Outer + inner framing rings.
  g.globalAlpha = alpha;
  g.strokeStyle = strokeColor;
  g.lineWidth = Math.max(0.9, r * 0.045);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = Math.max(0.7, r * 0.03);
  g.globalAlpha = alpha * 0.8;
  g.beginPath(); g.arc(cx, cy, r * 0.9, 0, Math.PI * 2); g.stroke();

  // Two overlaid squares (rotated 45°) → 8-point interlace star.
  const sq = r * 0.86;
  for (const rot of [0, Math.PI / 4]) {
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = cx + Math.cos(a) * sq;
      const py = cy + Math.sin(a) * sq;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    // soft fill
    g.globalAlpha = alpha * 0.16;
    g.fillStyle = fillColor;
    g.fill();
    // ink outline
    g.globalAlpha = alpha;
    g.lineWidth = Math.max(0.8, r * 0.035);
    g.strokeStyle = strokeColor;
    g.stroke();
  }

  // Inner octagon ring.
  g.globalAlpha = alpha * 0.85;
  g.lineWidth = Math.max(0.7, r * 0.03);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(a) * r * 0.34;
    const py = cy + Math.sin(a) * r * 0.34;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.stroke();

  // Centre dot.
  g.globalAlpha = alpha * 0.7;
  g.fillStyle = strokeColor;
  g.beginPath(); g.arc(cx, cy, r * 0.1, 0, Math.PI * 2); g.fill();

  g.restore();
}

/** Draw a marble inlay roundel: concentric rings + 12-petal motif. */
function drawRoundelMedallion(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  strokeColor: string, _baseColor: string, accentHex: string,
): void {
  g.save();
  g.lineJoin = 'round';
  g.globalAlpha = 0.34;
  g.strokeStyle = strokeColor;
  g.lineWidth = Math.max(0.8, r * 0.035);

  // 4 concentric rings
  for (const frac of [1.0, 0.72, 0.48, 0.26]) {
    g.beginPath();
    g.arc(cx, cy, r * frac, 0, Math.PI * 2);
    g.stroke();
  }

  // Petal ring: 12 arc-petals between inner rings
  const nPetals = 12;
  g.globalAlpha = 0.2;
  g.fillStyle = accentHex;
  for (let i = 0; i < nPetals; i++) {
    const angle = (i / nPetals) * Math.PI * 2;
    const nextAngle = ((i + 1) / nPetals) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    // Petal: filled arc segment from inner to outer ring
    g.beginPath();
    g.moveTo(cx + Math.cos(midAngle) * r * 0.26, cy + Math.sin(midAngle) * r * 0.26);
    g.arc(cx, cy, r * 0.48, midAngle - 0.18, midAngle + 0.18);
    g.closePath();
    g.fill();
  }

  // Spoke lines
  g.globalAlpha = 0.26;
  g.strokeStyle = strokeColor;
  g.lineWidth = Math.max(0.5, r * 0.02);
  for (let i = 0; i < nPetals; i++) {
    const angle = (i / nPetals) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(angle) * r * 0.26, cy + Math.sin(angle) * r * 0.26);
    g.lineTo(cx + Math.cos(angle) * r * 0.72, cy + Math.sin(angle) * r * 0.72);
    g.stroke();
  }

  // Center dot
  g.globalAlpha = 0.32;
  g.fillStyle = strokeColor;
  g.beginPath();
  g.arc(cx, cy, r * 0.06, 0, Math.PI * 2);
  g.fill();

  // Outer ring thick accent
  g.globalAlpha = 0.18;
  g.lineWidth = Math.max(1.5, r * 0.06);
  g.strokeStyle = strokeColor;
  g.beginPath();
  g.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
  g.stroke();

  g.restore();
}

// ── Exported mesh factories ──────────────────────────────────────────────────

export function makeGround(): THREE.Mesh {
  const cv = document.createElement('canvas');
  cv.width = BASE_W;
  cv.height = BASE_H;
  const g = cv.getContext('2d')!;
  drawGround(g, BASE_W, BASE_H);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace  = THREE.SRGBColorSpace;
  tex.anisotropy  = 16;  // max anisotropy for crisp paving at oblique angles
  tex.minFilter   = THREE.LinearMipmapLinearFilter;
  tex.magFilter   = THREE.LinearFilter;

  // Register draw closure so LOD system can re-rasterize at 2× on zoom-in
  textureRegistry.register(cv, drawGround, BASE_W, BASE_H, [tex], false);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cols, 1, rows),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  mesh.position.y = -0.5;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/**
 * Earth-tone apron extending beyond the main slab on west/east/north sides.
 */
export function makeApron(): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'apron';

  const apronMat = new THREE.MeshLambertMaterial({ color: 0xb8a882 });
  const apronY = -0.3;
  const apronH = 0.5;

  const west = new THREE.Mesh(new THREE.BoxGeometry(7, apronH, 22), apronMat);
  west.position.set(-17.5, apronY, 0);
  grp.add(west);

  const east = new THREE.Mesh(new THREE.BoxGeometry(7, apronH, 22), apronMat);
  east.position.set(17.5, apronY, 0);
  grp.add(east);

  const north = new THREE.Mesh(new THREE.BoxGeometry(42, apronH, 9), apronMat);
  north.position.set(0, apronY, -15.5);
  grp.add(north);

  return grp;
}
