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
  // Lift plaza colour toward white to compensate for MeshLambertMaterial attenuation
  const plazaNum = lightenNum(C.plaza, 0.42);   // ~0xf6f1e8 warm cream
  const baseHex  = hex(plazaNum);

  // Flagstone: pale warm limestone tones
  const stoneBase      = plazaNum;                      // 0xf6f1e8
  const stoneDark      = 0xe2d8c4;                      // noticeably darker stone variant
  const stoneMid       = 0xeee7d6;                      // mid variant
  const stoneMortarNum = 0xc8bfaf;                      // mortar seam — warm mid-grey, visible
  const mortarHex      = hex(stoneMortarNum);

  // Walkway: distinctly lighter white stone band (axial path)
  const walkStoneNum = lightenNum(C.marble, 0.30);    // ~0xf7f5ef near-white warm
  const walkHex      = hex(walkStoneNum);
  const walkDarkNum  = lightenNum(C.marble, 0.12);    // slightly darker variant
  const walkDarkHex  = hex(walkDarkNum);

  // Inlay: pale warm limestone brick for herringbone border — keeps ground light
  // These are only slightly darker/warmer than the base flagstones, not terracotta
  const brickDark  = lightenNum(0xddd0b8, 0.05);  // ~0xe6dcc8 warm pale buff
  const brickLight = lightenNum(0xe8ddc8, 0.10);  // ~0xeee6d8 lighter pale buff
  const brickMortarHex = hex(stoneMortarNum);      // same mortar as flagstones

  // Medallion stroke colours
  const medalStroke = darken(plazaNum, 0.22);         // warm mid-grey

  // ── 1. Base fill ─────────────────────────────────────────────────────────
  g.fillStyle = baseHex;
  g.fillRect(0, 0, w, h);

  // ── 2. Large limestone flagstones with per-stone tonal variation ─────────
  // Stone size: 2×3 tiles (~landscape rectangle, like real cut stone)
  const SW = tW * 2;  // stone width
  const SH = tH * 1.5; // stone height (roughly 2:3 ratio)
  const stoneRng = makeLCG(0xA3B7C1);

  // Draw stones in staggered rows
  const staggerCols = Math.ceil(w / SW) + 1;
  const staggerRows = Math.ceil(h / SH) + 1;

  for (let sr = 0; sr < staggerRows; sr++) {
    const offset = (sr % 2) * (SW * 0.5); // stagger offset for alternating rows
    for (let sc = 0; sc < staggerCols; sc++) {
      const px = sc * SW - offset;
      const py = sr * SH;
      if (px + SW < 0 || py + SH < 0 || px >= w || py >= h) continue;

      // LCG tonal variation: ±12% brightness per stone for natural limestone variety
      const vary = stoneRng() * 0.12 - 0.06;
      let stoneNum: number;
      const t = stoneRng();
      if (t < 0.3) stoneNum = stoneDark;
      else if (t < 0.65) stoneNum = stoneMid;
      else stoneNum = stoneBase;
      // Apply per-stone variation
      g.fillStyle = vary >= 0 ? hex(lightenNum(stoneNum, vary)) : darken(stoneNum, -vary);

      // Clip inset (mortar seam width)
      const seam = Math.max(1.2, tW * 0.045);
      const sx = px + seam * 0.5;
      const sy = py + seam * 0.5;
      const sW2 = SW - seam;
      const sH2 = SH - seam;
      if (sW2 <= 0 || sH2 <= 0) continue;
      g.fillRect(sx, sy, sW2, sH2);

      // Faint vein: 1 or 2 diagonal lines across stone
      const veinCount = stoneRng() < 0.35 ? 1 : (stoneRng() < 0.2 ? 2 : 0);
      if (veinCount > 0) {
        g.save();
        g.globalAlpha = 0.07 + stoneRng() * 0.06;
        g.strokeStyle = darken(stoneNum, 0.12);
        g.lineWidth = 0.4;
        for (let v = 0; v < veinCount; v++) {
          const vx0 = px + seam + stoneRng() * (SW - seam * 2) * 0.6;
          const vy0 = py + seam;
          const vx1 = vx0 + (stoneRng() - 0.5) * SW * 0.5;
          const vy1 = py + SH - seam;
          g.beginPath();
          g.moveTo(vx0, vy0);
          g.bezierCurveTo(
            vx0 + (stoneRng() - 0.5) * SW * 0.3, vy0 + SH * 0.3,
            vx1 + (stoneRng() - 0.5) * SW * 0.3, vy0 + SH * 0.6,
            vx1, vy1,
          );
          g.stroke();
        }
        g.restore();
      }
    }
  }

  // ── 3. Mortar grid over stones ────────────────────────────────────────────
  // Draw thin mortar lines at SW and SH intervals (both stagger-offset and non-offset)
  // We'll draw a regular grid for simplicity — it overlaps stone boundaries cleanly
  g.strokeStyle = mortarHex;
  g.lineWidth = Math.max(1.2, tW * 0.05);
  g.globalAlpha = 0.75;  // stronger mortar seams for visible flagstone joints
  // Horizontal mortar lines
  for (let sr = 0; sr <= staggerRows; sr++) {
    const y = sr * SH;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  // Vertical mortar lines (two passes: even rows and odd rows for stagger)
  for (let sr = 0; sr <= staggerRows; sr++) {
    const offset = (sr % 2) * (SW * 0.5);
    const y0 = sr * SH;
    const y1 = y0 + SH;
    for (let sc = 0; sc <= staggerCols + 1; sc++) {
      const x = sc * SW - offset;
      g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    }
  }
  g.globalAlpha = 1;

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

  // ── 5. Central axial walkway ──────────────────────────────────────────────
  // South entrance column: find the 'S' tile
  let southCol = 13; // default from layout
  for (let c = 0; c < cols; c++) {
    if (LAYOUT[19]?.[c] === 'S') { southCol = c; break; }
  }
  // Walkway: 3 tiles wide, centered on southCol
  const walkLeft   = (southCol - 1) * tW;
  const walkRight  = (southCol + 2) * tW;
  const walkWidth  = walkRight - walkLeft;

  // Center of plaza: row ~10
  const plazaCenterRow = 10;

  // Draw walkway from south edge to plaza center
  g.save();
  g.globalAlpha = 1;
  // Main walkway fill: lighter stone
  g.fillStyle = walkHex;
  g.fillRect(walkLeft, 0, walkWidth, h);

  // Walkway border bands (slightly darker lines parallel to walkway edges)
  g.strokeStyle = darken(walkStoneNum, 0.10);
  g.lineWidth = Math.max(1.5, tW * 0.06);
  g.beginPath();
  g.moveTo(walkLeft + g.lineWidth, 0);
  g.lineTo(walkLeft + g.lineWidth, h);
  g.stroke();
  g.beginPath();
  g.moveTo(walkRight - g.lineWidth, 0);
  g.lineTo(walkRight - g.lineWidth, h);
  g.stroke();
  g.restore();

  // Walkway internal stone joints (perpendicular bands across walkway)
  {
    const jointRng = makeLCG(0xF2D1A0);
    g.save();
    g.globalAlpha = 0.35;
    g.strokeStyle = mortarHex;
    g.lineWidth = Math.max(1, tW * 0.04);
    // Horizontal joints across walkway at every 1.5 tile intervals
    for (let jy = SH; jy < h; jy += SH) {
      g.beginPath();
      g.moveTo(walkLeft, jy);
      g.lineTo(walkRight, jy);
      g.stroke();
    }
    // Vertical split down center
    const wCenter = (walkLeft + walkRight) / 2;
    for (let jy = 0; jy < h; jy += SH) {
      const jy2 = jy + SH;
      // Alternate center line per band
      if (jointRng() > 0.5) {
        g.beginPath();
        g.moveTo(wCenter, jy);
        g.lineTo(wCenter, jy2);
        g.stroke();
      }
    }
    g.restore();
  }

  // ── 6. Star/cross medallion inlays along walkway ──────────────────────────
  // Place medallion inlays at regular intervals along the walkway
  const walkCenterX = (walkLeft + walkRight) / 2;
  const inlaySpacing = tH * 3.5; // ~3.5 rows apart
  const inlayRadius = walkWidth * 0.28;
  const inlayPositions: number[] = [];
  for (let y = tH * 4; y < h - tH * 2; y += inlaySpacing) {
    inlayPositions.push(y);
  }
  for (const iy of inlayPositions) {
    drawStarCrossMedallion(g, walkCenterX, iy, inlayRadius, medalStroke, walkDarkHex, 0.55);
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
  // At deterministic positions across the open plaza
  const medalPositions: [number, number][] = [
    [5.5,  6.5],
    [5.5,  13.5],
    [22.5, 6.5],
    [22.5, 13.5],
    [14,   plazaCenterRow],
    [9.5,  11.0],
    [18.5, 11.0],
  ];
  const medalRadius = tW * 2.2;
  for (const [mc, mr] of medalPositions) {
    const cx = mc * tW;
    const cy = mr * tH;
    drawRoundelMedallion(g, cx, cy, medalRadius, medalStroke, baseHex, walkHex);
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
      grad.addColorStop(0, hex(lightenNum(stoneMortarNum, 0.15)));
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

/** Draw a star/cross geometric inlay at (cx,cy) radius r.
 *  A 8-pointed star outline + inner cross + concentric rings. */
function drawStarCrossMedallion(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  strokeColor: string, fillColor: string, alpha: number,
): void {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = strokeColor;
  g.fillStyle = fillColor;
  g.lineWidth = Math.max(0.8, r * 0.04);

  // Outer circle
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();

  // 8-pointed star path
  const pts = 8;
  g.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r * 0.88 : r * 0.48;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.globalAlpha = alpha * 0.18;
  g.fill();
  g.globalAlpha = alpha;
  g.stroke();

  // Cross arms
  g.lineWidth = Math.max(0.6, r * 0.025);
  g.globalAlpha = alpha * 0.7;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(angle) * r * 0.88, cy + Math.sin(angle) * r * 0.88);
    g.stroke();
  }

  // Inner circle dot
  g.globalAlpha = alpha * 0.5;
  g.fillStyle = strokeColor;
  g.beginPath();
  g.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

/** Draw a marble inlay roundel: concentric rings + 12-petal motif. */
function drawRoundelMedallion(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  strokeColor: string, _baseColor: string, accentHex: string,
): void {
  g.save();
  g.globalAlpha = 0.22;
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
  g.globalAlpha = 0.14;
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
  g.globalAlpha = 0.18;
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
  g.globalAlpha = 0.25;
  g.fillStyle = strokeColor;
  g.beginPath();
  g.arc(cx, cy, r * 0.06, 0, Math.PI * 2);
  g.fill();

  // Outer ring thick accent
  g.globalAlpha = 0.12;
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
