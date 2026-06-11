import * as THREE from 'three';
import { textureRegistry, type DrawFn } from '../scene/lod';

const px = (n: number) => '#' + n.toString(16).padStart(6, '0');

/**
 * Create a canvas, fill with bg, register draw closure, return [canvas, ctx].
 * The draw closure is stored in the registry so the canvas can be
 * re-rasterized at any scale later without re-invoking the generator.
 */
function canvas(
  w: number, h: number, bg: number,
  drawFn?: DrawFn,
  priority = true,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = px(bg); g.fillRect(0, 0, w, h);
  if (drawFn) {
    textureRegistry.register(cv, drawFn, w, h, [], priority);
  }
  return [cv, g];
}

function toTexture(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  // Register texture with the entry that owns this canvas
  textureRegistry.addTexture(cv, t);
  return t;
}

/**
 * Banna'i (bannai) diagonal brick lattice — the workhorse pattern.
 * 1024² tileable canvas: diagonal grid of cream lines forming diamonds,
 * with a small square-meander cross motif inside each diamond.
 * bg = field colour, line = outline colour, motif = inner accent colour.
 */
export function bannai(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // Diamond cell size: one full diamond spans cellSize along each diagonal axis
    // 256px → 4 diamonds per tile; with PATTERN_WORLD=2 → ~1 tile per 2 world units → diamond ≈ 2.5 wu
    const cellSize = Math.round(S * 0.25); // 256/1024 = 0.25
    const lineW = Math.max(2, Math.round(S * 0.0098)); // 10/1024 ≈ 0.0098

    // Draw diagonal grid lines: two families of lines at +45° and -45°
    g.strokeStyle = px(line);
    g.lineWidth = lineW;
    g.lineCap = 'square';

    // We draw lines from outside the canvas to ensure coverage at edges
    const diag = Math.sqrt(2) * S;
    const step = cellSize;
    const count = Math.ceil(diag / step) + 4;

    // Family 1: top-left to bottom-right (+45°) — offset along perpendicular
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath();
      g.moveTo(offset - S, -S);
      g.lineTo(offset + S * 2, S * 2);
      g.stroke();
    }
    // Family 2: top-right to bottom-left (−45°)
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath();
      g.moveTo(offset + S, -S);
      g.lineTo(offset - S, S * 2);
      g.stroke();
    }

    // Diamond centre motif: a square rotated 45° (a smaller diamond) — covers ~25-30% of cell area
    const halfCell = cellSize / 2;
    const ms = Math.round(cellSize * 0.20);

    g.fillStyle = px(motif);

    for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
      for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
        // Diamond centre in rotated grid: transform back to screen coords
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

        // Draw a small filled diamond (rotated square) as the motif
        g.beginPath();
        g.moveTo(cx,      cy - ms);
        g.lineTo(cx + ms, cy);
        g.lineTo(cx,      cy + ms);
        g.lineTo(cx - ms, cy);
        g.closePath();
        g.fill();

        // Small accent squares at the four diagonal corners (inside the diamond cell)
        const dotR = Math.round(ms * 0.30);
        const dotOff = Math.round(cellSize * 0.36);
        for (const [dx, dy] of [[dotOff, 0], [-dotOff, 0], [0, dotOff], [0, -dotOff]] as [number, number][]) {
          g.save();
          g.translate(cx + dx, cy + dy);
          g.rotate(Math.PI / 4);
          g.fillRect(-dotR / 2, -dotR / 2, dotR, dotR);
          g.restore();
        }
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, true);
  draw(g, BASE, BASE);
  return toTexture(cv);
}

/**
 * Square swastika-meander interlock (hazarbaf) — portal flank panels.
 * 512² tileable. bg = field, fg = pattern lines.
 */
export function meander(bg: number, fg: number): THREE.CanvasTexture {
  const BASE = 512;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // Cell size: S/4 repeats → 4 across tile. Line width scaled with S.
    const cs = Math.round(S * 0.25); // 128/512
    const lw = Math.max(2, Math.round(S * 0.027)); // 14/512 ≈ 0.027

    g.fillStyle = px(fg);

    // Draw swastika-meander: a right-angle hook pattern that interlocks
    for (let row = 0; row < S / cs + 1; row++) {
      for (let col = 0; col < S / cs + 1; col++) {
        const ox = col * cs;
        const oy = row * cs;

        const inset = Math.round(S * 0.0195); // 10/512
        // Stroke border
        g.strokeStyle = px(fg);
        g.lineWidth = lw;
        g.strokeRect(ox + inset, oy + inset, cs - inset * 2, cs - inset * 2);

        // Inner meander cross (swastika-ish)
        const mid = cs / 2;
        const aw = lw;

        // Horizontal bar
        g.fillRect(ox + inset + lw, oy + mid - aw / 2, cs - inset * 2 - lw * 2, aw);
        // Vertical bar
        g.fillRect(ox + mid - aw / 2, oy + inset + lw, aw, cs - inset * 2 - lw * 2);

        // Four corner L-bends (makes the meander/swastika interlocking effect)
        g.fillStyle = px(bg);
        // Erase quarters to create the swastika rotation
        if ((row + col) % 2 === 0) {
          // top-right quadrant: erase bottom-left of that quadrant
          g.fillRect(ox + mid + aw / 2, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
          // bottom-left quadrant: erase top-right of that quadrant
          g.fillRect(ox + inset + lw, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
        } else {
          // top-left quadrant: erase bottom-right
          g.fillRect(ox + inset + lw, oy + mid + aw / 2, cs / 2 - inset - lw, cs / 2 - inset - lw);
          // bottom-right quadrant: erase top-left
          g.fillRect(ox + mid + aw / 2, oy + inset + lw, cs / 2 - inset - lw, cs / 2 - inset - lw);
        }
        g.fillStyle = px(fg);
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, false); // lower priority — stays 1x
  draw(g, BASE, BASE);
  return toTexture(cv);
}

/**
 * Stylized thuluth-like calligraphy band.
 * 1024×256. NOT real letters — flowing vertical strokes with varied heights and dots.
 * White on cobalt, reads as calligraphy at distance.
 */
export function calligraphyBand(bg: number, fg: number): THREE.CanvasTexture {
  const BASE_W = 1024, BASE_H = 256;

  // Glyph data as FRACTIONS of [BASE_W, BASE_H] → scale to actual W,H at draw time
  const glyphDataFrac: [number, number, boolean, boolean, number][] = [
    [50/1024,  160/256, true,  false, 80/1024],
    [80/1024,  100/256, false, true,  0],
    [115/1024, 170/256, true,  false, 70/1024],
    [155/1024, 120/256, false, false, 50/1024],
    [185/1024, 150/256, true,  true,  60/1024],
    [230/1024, 90/256,  false, false, 0],
    [265/1024, 160/256, true,  false, 90/1024],
    [305/1024, 130/256, false, true,  0],
    [335/1024, 110/256, false, false, 50/1024],
    [370/1024, 165/256, true,  false, 75/1024],
    [420/1024, 80/256,  false, true,  0],
    [455/1024, 155/256, true,  false, 85/1024],
    [490/1024, 125/256, false, false, 60/1024],
    [525/1024, 145/256, true,  true,  70/1024],
    [570/1024, 90/256,  false, false, 0],
    [605/1024, 165/256, true,  false, 95/1024],
    [645/1024, 120/256, false, true,  0],
    [675/1024, 105/256, false, false, 50/1024],
    [710/1024, 160/256, true,  false, 80/1024],
    [760/1024, 85/256,  false, true,  0],
    [795/1024, 155/256, true,  false, 75/1024],
    [830/1024, 130/256, false, false, 60/1024],
    [860/1024, 145/256, true,  true,  70/1024],
    [905/1024, 90/256,  false, false, 0],
    [940/1024, 160/256, true,  false, 90/1024],
    [975/1024, 110/256, false, true,  0],
  ];

  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, W, H);

    // Top and bottom border stripes
    const borderH = Math.round(H * (18 / 256));
    g.fillStyle = px(fg);
    g.fillRect(0, 0, W, borderH);
    g.fillRect(0, H - borderH, W, borderH);

    // Inner border lines
    g.strokeStyle = px(fg);
    g.lineWidth = Math.max(1, Math.round(H * (4 / 256)));
    const ibInset = Math.round(H * (6 / 256));
    g.strokeRect(ibInset, ibInset, W - ibInset * 2, H - ibInset * 2);

    const baseY = H - Math.round(H * (28 / 256)); // bottom of strokes

    for (const [xFrac, hFrac, hasTopCross, hasDot, crossWFrac] of glyphDataFrac) {
      const x = Math.round(xFrac * W);
      const strokeH = Math.round(hFrac * H);
      const crossW = Math.round(crossWFrac * W);
      const sw = Math.max(4, Math.round(H * (12 / 256))); // stroke width
      const topY = baseY - strokeH;

      // Main vertical stroke (slightly tapered — wider at bottom)
      g.fillStyle = px(fg);
      g.beginPath();
      g.moveTo(x - sw / 2 - 2, baseY);
      g.lineTo(x - sw / 2, topY);
      g.lineTo(x + sw / 2, topY);
      g.lineTo(x + sw / 2 + 2, baseY);
      g.closePath();
      g.fill();

      // Horizontal cross at top (like alif with crossbar)
      if (hasTopCross && crossW > 0) {
        const crossH = Math.max(4, Math.round(H * (10 / 256)));
        g.fillRect(x - crossW / 2, topY - crossH, crossW, crossH);
        // Small serifs on ends
        const sfw = Math.max(2, Math.round(W * (8 / 1024)));
        g.fillRect(x - crossW / 2 - sfw / 2, topY - crossH - sfw / 2, sfw, crossH + sfw / 2);
        g.fillRect(x + crossW / 2 - sfw / 2, topY - crossH - sfw / 2, sfw, crossH + sfw / 2);
      }

      // Dot accent above stroke
      if (hasDot) {
        const dotR = Math.max(3, Math.round(H * (7 / 256)));
        g.beginPath();
        g.arc(x, topY - Math.round(H * (22 / 256)), dotR, 0, Math.PI * 2);
        g.fill();
      }

      // Curved baseline connector to next visible stroke (subtle horizontal link)
      g.strokeStyle = px(fg);
      g.lineWidth = Math.max(2, Math.round(H * (5 / 256)));
      g.beginPath();
      g.moveTo(x + sw / 2, baseY - Math.round(H * (8 / 256)));
      g.quadraticCurveTo(
        x + Math.round(W * (20 / 1024)),
        baseY + Math.round(H * (4 / 256)),
        x + Math.round(W * (34 / 1024)),
        baseY - Math.round(H * (12 / 256)),
      );
      g.stroke();
    }
  }

  const [cv, g] = canvas(BASE_W, BASE_H, bg, draw, true);
  draw(g, BASE_W, BASE_H);
  return toTexture(cv, 2, 1);
}

/**
 * Non-tiling framed panel texture: buff field, kufic-meander border frame,
 * pointed-arch outline inside filled with bannai-style diagonal lattice.
 * Used on wing fronts. High-contrast cobalt frame + prominent arch outline.
 */
export function archPanel(w: number, h: number): THREE.CanvasTexture {
  const W = Math.max(w, 32), H = Math.max(h, 32);

  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = px(C_SAND); g.fillRect(0, 0, W, H);

    // Wide cobalt border frame (10% of width) — must be visible at iso scale
    const frameW = Math.round(W * 0.10);

    // --- Outer cobalt border frame ---
    g.fillStyle = px(C_COBALT);
    g.fillRect(0, 0, W, frameW);
    g.fillRect(0, H - frameW, W, frameW);
    g.fillRect(0, 0, frameW, H);
    g.fillRect(W - frameW, 0, frameW, H);

    // Cream inner accent line
    const ib = frameW + 3;
    g.strokeStyle = px(C_CREAM);
    g.lineWidth = Math.max(3, Math.round(W * 0.015));
    g.strokeRect(ib, ib, W - ib * 2, H - ib * 2);

    // Kufic step-pattern along frame strips (cream squares on cobalt)
    g.fillStyle = px(C_CREAM);
    const stepSize = Math.round(frameW * 0.7);
    const stepsX = Math.max(2, Math.floor(W / (stepSize * 1.8)));
    const stepsY = Math.max(2, Math.floor(H / (stepSize * 1.8)));
    for (let i = 0; i < stepsX; i++) {
      const x = (i + 0.5) * (W / stepsX);
      const sq = Math.round(stepSize * 0.55);
      g.fillRect(x - sq / 2, Math.round(frameW * 0.22), sq, sq);
      g.fillRect(x - sq / 2, H - Math.round(frameW * 0.22) - sq, sq, sq);
    }
    for (let i = 0; i < stepsY; i++) {
      const y = (i + 0.5) * (H / stepsY);
      const sq = Math.round(stepSize * 0.55);
      g.fillRect(Math.round(frameW * 0.22), y - sq / 2, sq, sq);
      g.fillRect(W - Math.round(frameW * 0.22) - sq, y - sq / 2, sq, sq);
    }

    // --- Inner field: warm sand with subtle cobalt diamond lattice ---
    const padding = frameW + Math.round(W * 0.04);
    const innerX = padding, innerY = padding;
    const innerW = W - padding * 2, innerH = H - padding * 2;

    if (innerW > 4 && innerH > 4) {
      g.save();
      g.beginPath();
      g.rect(innerX, innerY, innerW, innerH);
      g.clip();

      // Warm sand field
      g.fillStyle = px(C_SAND);
      g.fillRect(innerX, innerY, innerW, innerH);

      // Diagonal lattice lines (cobalt, more visible than cream)
      const cellSize = Math.round(innerW * 0.30);
      const lineW2 = Math.max(2, Math.round(cellSize * 0.05));
      const halfCell = cellSize / 2;
      g.strokeStyle = px(C_COBALT);
      g.lineWidth = lineW2;
      g.globalAlpha = 0.35; // semi-transparent so lattice is subtle but present
      g.lineCap = 'square';
      const diagLen = Math.sqrt(2) * Math.max(innerW, innerH);
      const cnt = Math.ceil(diagLen / cellSize) + 4;
      for (let i = -cnt; i < cnt * 2; i++) {
        const off = i * cellSize;
        g.beginPath();
        g.moveTo(innerX + off - innerH, innerY - innerH);
        g.lineTo(innerX + off + innerH * 2, innerY + innerH * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(innerX + innerW + off - innerH, innerY - innerH);
        g.lineTo(innerX + off - innerH, innerY + innerH * 2);
        g.stroke();
      }
      g.globalAlpha = 1.0;

      // Cobalt diamond motifs at intersections
      g.fillStyle = px(C_COBALT);
      const ms = Math.round(cellSize * 0.26);
      for (let iy = -2; iy < Math.ceil(innerH / halfCell) + 4; iy++) {
        for (let ix = -2; ix < Math.ceil(innerW / halfCell) + 4; ix++) {
          const cx = innerX + (ix + iy) * halfCell;
          const cy = innerY + (iy - ix) * halfCell;
          if (cx < innerX - cellSize || cx > innerX + innerW + cellSize) continue;
          if (cy < innerY - cellSize || cy > innerY + innerH + cellSize) continue;
          g.beginPath();
          g.moveTo(cx, cy - ms);
          g.lineTo(cx + ms, cy);
          g.lineTo(cx, cy + ms);
          g.lineTo(cx - ms, cy);
          g.closePath();
          g.fill();
        }
      }

      g.restore();
    }

    // --- Prominent pointed arch outline ---
    const archInset = frameW + Math.round(W * 0.06);
    const aX = archInset;
    const aW = W - archInset * 2;
    const aR = aW / 2;
    const aY = frameW + Math.round(H * 0.04);
    const aH = H - aY - frameW * 0.5;

    // Cobalt outer arch (thick — dominant feature)
    const archLW = Math.max(8, Math.round(W * 0.035));
    g.strokeStyle = px(C_COBALT);
    g.lineWidth = archLW;
    g.beginPath();
    g.moveTo(aX, aY + aH);
    g.lineTo(aX, aY + aR);
    g.quadraticCurveTo(aX, aY + aR * 0.08, aX + aR, aY);
    g.quadraticCurveTo(aX + aW, aY + aR * 0.08, aX + aW, aY + aR);
    g.lineTo(aX + aW, aY + aH);
    g.stroke();

    // Turquoise inner arch (thinner accent line)
    const iLW = Math.max(4, Math.round(W * 0.018));
    const iad = Math.round(aW * 0.07);
    g.strokeStyle = px(0x42c8c8);
    g.lineWidth = iLW;
    g.beginPath();
    g.moveTo(aX + iad, aY + aH);
    g.lineTo(aX + iad, aY + (aR - iad));
    g.quadraticCurveTo(aX + iad, aY + aR * 0.12 + iad, aX + aR, aY + iad);
    g.quadraticCurveTo(aX + aW - iad, aY + aR * 0.12 + iad, aX + aW - iad, aY + (aR - iad));
    g.lineTo(aX + aW - iad, aY + aH);
    g.stroke();
  }

  const [cv, g] = canvas(W, H, C_SAND, draw, true);
  draw(g, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  textureRegistry.addTexture(cv, t);
  return t;
}

/**
 * Dense pylon face texture for portal flanks.
 * Matches tilework.jpg density:
 *   - Smaller lattice cell (×0.6 vs bannai) for tighter diamonds
 *   - 8-pointed star accents inside diamonds
 *   - Kufic step-meander border strips framing all four edges
 * bg = field, line = lattice lines, motif = star/accent colour, border = border strip
 */
export function pylonFace(bg: number, line: number, motif: number, border: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // --- KUFIC BORDER STRIP ---
    const bw = Math.round(S * 0.0586); // 60/1024 ≈ 0.0586
    g.fillStyle = px(border);
    g.fillRect(0, 0, S, bw);           // top
    g.fillRect(0, S - bw, S, bw);     // bottom
    g.fillRect(0, 0, bw, S);          // left
    g.fillRect(S - bw, 0, bw, S);     // right

    // Kufic step pattern (line-coloured squares on border)
    g.fillStyle = px(line);
    const kuficStep = Math.round(S * 0.0215); // 22/1024
    const sq = Math.round(S * 0.0117); // 12/1024

    // Top and bottom strips
    for (let i = 0; i < Math.floor(S / kuficStep); i++) {
      const x = i * kuficStep + kuficStep / 2;
      const yOff = (i % 3 === 1) ? Math.round(bw * 0.133) : Math.round(bw * 0.233);
      g.fillRect(x - sq / 2, yOff, sq, bw - yOff * 1.5);
      g.fillRect(x - sq / 2, S - bw + yOff, sq, bw - yOff * 1.5);
    }
    // Left and right strips (vertical)
    for (let i = 0; i < Math.floor(S / kuficStep); i++) {
      const y = i * kuficStep + kuficStep / 2;
      const xOff = (i % 3 === 1) ? Math.round(bw * 0.133) : Math.round(bw * 0.233);
      g.fillRect(xOff, y - sq / 2, bw - xOff * 1.5, sq);
      g.fillRect(S - bw + xOff, y - sq / 2, bw - xOff * 1.5, sq);
    }

    // Inner border accent line (thin line inside the border strip)
    g.strokeStyle = px(line);
    g.lineWidth = Math.max(1, Math.round(S * 0.003));
    const ibPad = bw + Math.round(S * 0.004);
    g.strokeRect(ibPad, ibPad, S - ibPad * 2, S - ibPad * 2);

    // --- DENSE DIAGONAL LATTICE (×0.6 of bannai → ~1.5 world units per diamond) ---
    // Clip to inner field (inside border)
    const innerPad = bw + Math.round(S * 0.008);
    g.save();
    g.beginPath();
    g.rect(innerPad, innerPad, S - innerPad * 2, S - innerPad * 2);
    g.clip();

    const cellSize = Math.round(S * 0.150); // 154/1024 ≈ 0.150
    const lineW = Math.max(2, Math.round(S * 0.0068)); // 7/1024 ≈ 0.0068

    g.strokeStyle = px(line);
    g.lineWidth = lineW;
    g.lineCap = 'square';

    const diag = Math.sqrt(2) * S;
    const step = cellSize;
    const count = Math.ceil(diag / step) + 4;

    // Family 1: +45°
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath();
      g.moveTo(offset - S, -S);
      g.lineTo(offset + S * 2, S * 2);
      g.stroke();
    }
    // Family 2: -45°
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath();
      g.moveTo(offset + S, -S);
      g.lineTo(offset - S, S * 2);
      g.stroke();
    }

    // --- 8-POINTED STAR ACCENT inside each diamond cell ---
    const halfCell = cellSize / 2;
    const starR = Math.round(cellSize * 0.28); // outer star radius
    const innerStarR = Math.round(cellSize * 0.11); // inner star notch

    g.fillStyle = px(motif);

    for (let iy = -3; iy < Math.ceil(S / halfCell) + 3; iy++) {
      for (let ix = -3; ix < Math.ceil(S / halfCell) + 3; ix++) {
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

        // 8-pointed star: 8 outer points + 8 inner notches
        const pts = 8;
        g.beginPath();
        for (let p = 0; p < pts * 2; p++) {
          const a = (p * Math.PI / pts) - Math.PI / 2;
          const r = p % 2 === 0 ? starR : innerStarR;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          p === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath();
        g.fill();

        // Tiny accent square at the four cardinal notches
        const dotR = Math.round(innerStarR * 0.55);
        const dotOff = Math.round(cellSize * 0.40);
        g.save();
        g.fillStyle = px(line);
        for (const [dx, dy] of [[dotOff, 0], [-dotOff, 0], [0, dotOff], [0, -dotOff]] as [number, number][]) {
          g.save();
          g.translate(cx + dx, cy + dy);
          g.rotate(Math.PI / 4);
          g.fillRect(-dotR / 2, -dotR / 2, dotR, dotR);
          g.restore();
        }
        g.restore();
        g.fillStyle = px(motif);
      }
    }

    g.restore();
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, true);
  draw(g, BASE, BASE);
  return toTexture(cv);
}

// Internal colour constants used by archPanel and portal helpers (avoids importing palette)
const C_SAND   = 0xecdfc4;
const C_COBALT = 0x1e5fa8;
const C_CREAM  = 0xfff6e3;
// Additional portal palette constants (our C palette authoritative)
const C_COBALT_DARK  = 0x16396e;
const C_TURQUOISE    = 0x42c8c8;
const C_TURQUOISE_HI = 0x5fe0e0;
const C_GOLD         = 0xd9b545;
const C_TIGER        = 0xe8943a;
const C_STRIPE       = 0x5a3414;
const C_NIGHT        = 0x0d1a2e;
const C_WHITE        = 0xfff6e3;

/** 8-pointed girih star lattice: proper 8-pointed star polygon with inner/outer radii. */
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  const S = 256;

  function draw(g: CanvasRenderingContext2D, totalW: number, _totalH: number) {
    const cellS = totalW / cells; // size per cell at current scale
    g.fillStyle = px(bg); g.fillRect(0, 0, totalW, totalW);

    for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
      const ox = cx * cellS + cellS / 2, oy = cy * cellS + cellS / 2;
      const outerR = cellS * 0.44;
      const innerR = cellS * 0.18;
      const points = 8;

      // Draw 8-pointed star with alternating outer/inner radii
      g.fillStyle = px(star);
      g.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = (i * Math.PI / points) - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath();
      g.fill();

      // Accent small squares between star points (rotated 45°, at inner positions)
      g.fillStyle = px(accent);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) - Math.PI / 8;
        const midR = (outerR + innerR) * 0.5;
        const cx2 = ox + Math.cos(a) * midR;
        const cy2 = oy + Math.sin(a) * midR;
        const sq = cellS * 0.07;
        g.save();
        g.translate(cx2, cy2);
        g.rotate(a);
        g.fillRect(-sq, -sq, sq * 2, sq * 2);
        g.restore();
      }

      // Small center circle in background color
      g.fillStyle = px(bg);
      g.beginPath();
      g.arc(ox, oy, cellS * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  }

  const [cv, g] = canvas(S * cells, S * cells, bg, draw, false); // priority=false: no 2x (canvas too large)
  draw(g, S * cells, S * cells);
  return toTexture(cv);
}

// ─── Palette constants (our C, kept as hex numbers) ────────────────────────
const REF_SAND        = 0xecdfc4;
const REF_COBALT      = 0x1e5fa8;
const REF_COBALT_DARK = 0x16396e;
const REF_TURQUOISE   = 0x42c8c8;
const REF_TURQ_HI     = 0x5fe0e0;
const REF_GOLD        = 0xd9b545;
const REF_WHITE       = 0xfff6e3;

/** LCG seeded random — no Math.random. Returns 0..1. */
function lcg(seed: number) {
  let s = seed | 1; // ensure non-zero
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** Persian pointed arch (canvas coords, y grows down). */
function archPathCtx(
  g: CanvasRenderingContext2D,
  cx: number, baseY: number, aw: number, springY: number, apexY: number,
) {
  const hw = aw / 2;
  g.beginPath();
  g.moveTo(cx - hw, baseY);
  g.lineTo(cx - hw, springY);
  g.bezierCurveTo(
    cx - hw, springY - (springY - apexY) * 0.55,
    cx - aw * 0.30, apexY + (springY - apexY) * 0.18, cx, apexY,
  );
  g.bezierCurveTo(
    cx + aw * 0.30, apexY + (springY - apexY) * 0.18,
    cx + hw, springY - (springY - apexY) * 0.55, cx + hw, springY,
  );
  g.lineTo(cx + hw, baseY);
  g.closePath();
}

/** Eight-pointed star (khatam). */
function star8ctx(
  g: CanvasRenderingContext2D,
  cx: number, cy: number, R: number, color: string, rot = Math.PI / 8,
) {
  const r = R * 0.45;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = rot + (i * Math.PI) / 8;
    const rad = i % 2 === 0 ? R : r;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

/** Blocky pseudo-kufic strip. Cobalt bg, white glyphs, gold trim lines. */
function drawKuficBandCtx(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  seed = 1, goldTrim = false,
) {
  g.save();
  g.fillStyle = px(REF_COBALT); g.fillRect(x, y, w, h);
  g.fillStyle = px(REF_WHITE);
  const rnd = lcg(seed);
  const bw = h * 0.16;
  for (let gx = x + h * 0.4; gx < x + w - h * 0.4; gx += h * 0.55) {
    const tall = h * (0.45 + rnd() * 0.35);
    g.fillRect(gx, y + h * 0.85 - tall, bw, tall);
    if (rnd() > 0.45) g.fillRect(gx, y + h * 0.85 - bw, h * 0.38, bw);
    if (rnd() > 0.70) g.fillRect(gx, y + h * 0.85 - tall, h * 0.3, bw);
  }
  // gold trim lines (always for drum; optional for parapet)
  if (goldTrim) {
    g.fillStyle = px(REF_GOLD);
    g.fillRect(x, y, w, h * 0.06);
    g.fillRect(x, y + h * 0.94, w, h * 0.06);
  }
  g.restore();
}

/** Girih band: cobalt field packed with alternating turquoise/white 8-point stars. */
function drawGirihBandCtx(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  vertical: boolean,
) {
  g.save();
  g.fillStyle = px(REF_COBALT); g.fillRect(x, y, w, h);
  const step = vertical ? w : h;
  const n = Math.max(1, Math.round((vertical ? h : w) / step));
  for (let i = 0; i < n; i++) {
    const cx = vertical ? x + w / 2 : x + step * (i + 0.5);
    const cy = vertical ? y + step * (i + 0.5) : y + h / 2;
    star8ctx(g, cx, cy, step * 0.42, i % 2 ? px(REF_TURQUOISE) : px(REF_WHITE));
    star8ctx(g, cx, cy, step * 0.20, px(REF_GOLD));
  }
  g.restore();
}

/** Square-kufic labyrinth fret — filled panel head. */
const SQ_KUFIC_PAT = [
  '############.',
  '#..........#.',
  '#.########.#.',
  '#.#......#.#.',
  '#.#.####.#.#.',
  '#.#.#..#...#.',
  '#.#.#.#####..',
  '#...#......#.',
  '#.#########.',
  '#...........',
  '#############',
  '.............',
];
function drawSqKufic(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fg: string, bg: string, accent: string,
) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  const rows = SQ_KUFIC_PAT.length, cols = 13;
  const cell = Math.max(4, Math.min(w, h) / 14);
  for (let ty = 0; ty * cell * rows < h + cell * rows; ty++) {
    for (let tx = 0; tx * cell * cols < w + cell * cols; tx++) {
      const col = (tx + ty) % 2 ? fg : accent;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (SQ_KUFIC_PAT[j][i] !== '#') continue;
          g.fillStyle = col;
          g.fillRect(x + tx * cell * cols + i * cell, y + ty * cell * rows + j * cell,
            cell * 0.92, cell * 0.92);
        }
      }
    }
  }
  g.restore();
}

/**
 * Full 2-storey arcade facade (port of reference drawArcadeFace).
 * Non-tiling; sized to wing dimensions. Priority=true → 2x LOD tier.
 * goldTrim=true → Tilya-Kori gilt line under parapet.
 */
export function arcadeFacade(wingLenM: number, wingHM: number, goldTrim = false): THREE.CanvasTexture {
  // Base width: clamp to 1024 wide. Height is proportional.
  const W = Math.min(1024, Math.max(256, Math.round(wingLenM * 52)));
  const H = Math.max(128, Math.round(W * wingHM / wingLenM));

  // Scale bays to wing length: 1 bay per ~2.5 world units, min 2
  const bays  = Math.max(2, Math.round(wingLenM / 2.5));
  const stories = 2;

  function draw(g: CanvasRenderingContext2D, w: number, h: number) {
    const rnd = lcg(17);

    // ── BASE WALL: buff brick coursing ────────────────────────────
    g.fillStyle = px(REF_SAND); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,90,50,0.22)'; g.lineWidth = 1;
    const courseH = Math.max(4, Math.round(h * 0.018));
    for (let y = 0; y < h; y += courseH) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    // seeded tonal variation
    const patchCount = Math.round(w / 3);
    for (let i = 0; i < patchCount; i++) {
      const px2 = rnd() * w, py2 = rnd() * h;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,235,190,0.05)' : 'rgba(90,60,30,0.05)';
      g.fillRect(px2, py2, 18, 6);
    }

    // ── CRENELLATED TURQUOISE CREST ───────────────────────────────
    const crest = h * 0.035;
    const parapetH = h * 0.085;
    g.fillStyle = px(REF_TURQUOISE);
    for (let x = 0; x < w; x += crest * 2.2) {
      g.beginPath();
      g.moveTo(x, crest); g.lineTo(x + crest * 1.1, crest);
      g.lineTo(x + crest * 0.55, 0); g.closePath(); g.fill();
    }

    // ── KUFIC PARAPET BAND ────────────────────────────────────────
    drawKuficBandCtx(g, 0, crest, w, parapetH, 7, goldTrim);
    if (goldTrim) {
      g.fillStyle = px(REF_GOLD);
      g.fillRect(0, crest + parapetH, w, h * 0.012);
    }

    // ── MARBLE DADO AT BASE ───────────────────────────────────────
    const dadoH = h * 0.07;
    g.fillStyle = '#cfc3a4';
    g.fillRect(0, h - dadoH, w, dadoH);
    g.fillStyle = 'rgba(120,105,70,0.4)';
    const bayW = w / bays;
    for (let x = 0; x < w; x += bayW / 4) g.fillRect(x, h - dadoH, 2, dadoH);

    // ── PER-BAY AND PER-STOREY FEATURES ──────────────────────────
    const top0  = crest + parapetH;
    const storyH = (h - top0 - dadoH) / stories;

    for (let s = 0; s < stories; s++) {
      const top = top0 + s * storyH;
      for (let b = 0; b < bays; b++) {
        const x0 = b * bayW;
        const m  = bayW * 0.12;

        // Cobalt tile frame
        g.fillStyle = px(REF_COBALT);
        g.fillRect(x0 + m * 0.45, top + storyH * 0.05, bayW - m * 0.9, storyH * 0.93);
        g.strokeStyle = px(REF_WHITE);
        g.lineWidth = Math.max(1.5, bayW * 0.012);
        g.strokeRect(x0 + m * 0.45, top + storyH * 0.05, bayW - m * 0.9, storyH * 0.93);

        // Square-kufic panel head
        drawSqKufic(
          g, x0 + m * 0.7, top + storyH * 0.08, bayW - m * 1.4, storyH * 0.13,
          (b + s) % 2 ? px(REF_WHITE) : px(REF_TURQ_HI),
          px(REF_COBALT), px(REF_TURQUOISE),
        );

        // Sand recess field (inside frame)
        g.fillStyle = px(REF_SAND);
        g.fillRect(x0 + m, top + storyH * 0.24, bayW - m * 2, storyH * 0.74);

        // Recessed pointed-arch niche with shadow gradient
        const aw    = bayW - m * 2.7;
        const base  = top + storyH * 0.98;
        const spring = top + storyH * 0.52;
        const apex  = top + storyH * 0.30;
        const grad  = g.createLinearGradient(0, apex, 0, base);
        grad.addColorStop(0, '#4a3318');
        grad.addColorStop(0.25, '#5d4426');
        grad.addColorStop(1, '#8a6a3e');
        archPathCtx(g, x0 + bayW / 2, base, aw, spring, apex);
        g.fillStyle = grad; g.fill();

        // Turquoise outer arch outline
        g.lineWidth = Math.max(2, bayW * 0.03);
        g.strokeStyle = px(REF_TURQUOISE); g.stroke();

        // White double arch outline (slightly wider)
        g.lineWidth = Math.max(1, bayW * 0.012);
        g.strokeStyle = px(REF_WHITE);
        archPathCtx(g, x0 + bayW / 2, base, aw + bayW * 0.05, spring - storyH * 0.012, apex - storyH * 0.02);
        g.stroke();

        // Ground-floor open doorway (dark hujra)
        if (s === stories - 1) {
          g.fillStyle = '#241a0e';
          g.fillRect(x0 + bayW / 2 - aw * 0.28, top + storyH * 0.62, aw * 0.56, storyH * 0.36);
        }

        // Turquoise spandrel rosettes
        star8ctx(g, x0 + m * 1.5,          top + storyH * 0.33, bayW * 0.05, px(REF_TURQ_HI));
        star8ctx(g, x0 + bayW - m * 1.5,   top + storyH * 0.33, bayW * 0.05, px(REF_TURQ_HI));
      }

      // Girih pilaster strips between bays
      for (let b = 0; b <= bays; b++) {
        const bx = b * bayW;
        drawGirihBandCtx(g, bx - bayW * 0.045, top + storyH * 0.02, bayW * 0.09, storyH * 0.96, true);
      }
    }
  }

  const [cv, g] = canvas(W, H, REF_SAND, draw, true);
  draw(g, W, H);
  // Non-tiling: clamp wrapping
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  textureRegistry.addTexture(cv, t);
  return t;
}

/**
 * Brick wall with seeded tonal variation + banna'i diamond lattice.
 * Upgrade over plain `bannai`: adds visible brick coursing.
 * Tileable 1024².
 */
export function brickWall(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    const rnd = lcg(42);
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // Brick coursing
    const brickH = Math.round(S * 0.031); // ~32px at 1024
    const brickW = Math.round(S * 0.094); // ~96px at 1024
    g.strokeStyle = 'rgba(120,90,50,0.28)'; g.lineWidth = Math.max(1, S * 0.0015);
    for (let y = 0; y < S; y += brickH) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      const row = Math.round(y / brickH);
      const xOff = row % 2 ? 0 : brickW / 2;
      for (let x = xOff; x < S; x += brickW) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + brickH); g.stroke();
      }
    }

    // Seeded tonal patches (not Math.random)
    const patchCount = Math.round(S * S / 3200);
    for (let i = 0; i < patchCount; i++) {
      const px2 = rnd() * S, py2 = rnd() * S;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,235,190,0.05)' : 'rgba(90,60,30,0.05)';
      g.fillRect(px2, py2, Math.round(S * 0.023), Math.round(S * 0.008));
    }

    // Banna'i glazed-brick diamonds (same logic as original makeWallTexture)
    const gsize = Math.round(S * 0.0625); // 64/1024
    for (let j = 0; j < S / gsize; j++) {
      for (let i = 0; i < S / gsize; i++) {
        if ((i + j) % 2 === 0) continue;
        const cx2 = i * gsize + gsize / 2, cy2 = j * gsize + gsize / 2;
        const s2 = gsize * 0.30;
        g.save();
        g.translate(cx2, cy2); g.rotate(Math.PI / 4);
        g.fillStyle = px(motif); g.fillRect(-s2, -s2, s2 * 2, s2 * 2);
        g.fillStyle = px(line);  g.fillRect(-s2 * 0.45, -s2 * 0.45, s2 * 0.9, s2 * 0.9);
        g.restore();
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, bg, draw, true);
  draw(g, BASE, BASE);
  return toTexture(cv);
}

/**
 * Drum inscription band: grand kufic inscription + turquoise cap + dark base + gold trim lines.
 * Port of reference makeDrumTexture. 1024×256 tileable.
 */
export function drumBand(): THREE.CanvasTexture {
  const W = 1024, H = 256;

  function draw(g: CanvasRenderingContext2D, w: number, h: number) {
    // Turquoise upper cap
    g.fillStyle = px(REF_TURQUOISE); g.fillRect(0, 0, w, h * 0.22);
    // Dark cobalt lower band
    g.fillStyle = px(REF_COBALT_DARK); g.fillRect(0, h * 0.78, w, h * 0.22);
    // Gold trim lines
    g.fillStyle = px(REF_GOLD);
    g.fillRect(0, h * 0.20, w, h * 0.03);
    g.fillRect(0, h * 0.77, w, h * 0.03);
    // Grand kufic inscription in the middle 56%
    drawKuficBandCtx(g, 0, h * 0.22, w, h * 0.56, 3, false);
  }

  const [cv, g] = canvas(W, H, REF_TURQUOISE, draw, true);
  draw(g, W, H);
  return toTexture(cv, 3, 1); // repeat 3× around drum circumference
}

/**
 * Minaret shaft: spiral banna'i lattice + 3 kufic inscription collars.
 * Port of reference makeMinaretTexture. 512×1024, repeat 2 wide.
 */
export function minaretShaft(): THREE.CanvasTexture {
  const W = 512, H = 1024;

  function draw(g: CanvasRenderingContext2D, w: number, h: number) {
    g.fillStyle = px(REF_SAND); g.fillRect(0, 0, w, h);

    // Spiral banna'i: offset every other row by half-step to read as spiral
    const gsize = Math.round(w * 0.109); // ~56/512
    for (let j = 0; j < h / gsize; j++) {
      for (let i = 0; i < w / gsize; i++) {
        if ((i + j) % 2 === 0) continue;
        // Spiral shift: each row shifts by a fraction of gsize
        const spiralShift = (j * gsize * 0.12) % gsize;
        const cx2 = (i + 0.5) * gsize + spiralShift;
        const cy2 = (j + 0.5) * gsize;
        const s2 = gsize * 0.27;
        g.save();
        g.translate(cx2, cy2); g.rotate(Math.PI / 4);
        g.fillStyle = px(REF_COBALT); g.fillRect(-s2, -s2, s2 * 2, s2 * 2);
        g.fillStyle = px(REF_TURQUOISE); g.fillRect(-s2 * 0.4, -s2 * 0.4, s2 * 0.8, s2 * 0.8);
        g.restore();
      }
    }

    // Three inscription collars at ~16%, 50%, 84% height
    const collarH = Math.round(h * 0.059); // ~60/1024
    for (const fy of [0.16, 0.50, 0.84]) {
      drawKuficBandCtx(g, 0, Math.round(h * fy - collarH / 2), w, collarH, Math.round(fy * 100), true);
    }
  }

  const [cv, g] = canvas(W, H, REF_SAND, draw, true);
  draw(g, W, H);
  return toTexture(cv, 2, 1);
}

/**
 * Seamless girih tile: cobalt bg, white 8-point star centre, gold inner star,
 * turquoise quarter-stars at corners → tiles seamlessly.
 * Port of reference makeGirihTileTexture. 256². Used on pilaster strips + inner arch.
 */
export function girihTile(): THREE.CanvasTexture {
  const S = 256;

  function draw(g: CanvasRenderingContext2D, w: number, _h: number) {
    g.fillStyle = px(REF_COBALT); g.fillRect(0, 0, w, w);
    star8ctx(g, w / 2, w / 2, w * 0.34, px(REF_WHITE));
    star8ctx(g, w / 2, w / 2, w * 0.15, px(REF_GOLD));
    // Quarter-stars at each corner for seamless tiling
    for (const [cx, cy] of [[0, 0], [w, 0], [0, w], [w, w]] as [number, number][]) {
      star8ctx(g, cx, cy, w * 0.20, px(REF_TURQUOISE));
    }
  }

  const [cv, g] = canvas(S, S, REF_COBALT, draw, false); // pilasters don't need 2x
  draw(g, S, S);
  return toTexture(cv);
}

/**
 * Spandrel tiger panel — same tiger+sun motif but
 * cropped to a square 512×512 aspect, no outer black border frame.
 * Used as left and right spandrel plane textures on Sher-Dor portal.
 * The caller mirrors the right-side copy (scale.x = -1) to get the symmetric pair.
 */
export function tigerSpandrel(): THREE.CanvasTexture {
  const BASE = 512;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    const sc = S / 512; // scale factor
    g.fillStyle = px(0x1c5d99); g.fillRect(0, 0, S, S);

    // --- SUN (upper right) ---
    const sx = 390 * sc, sy = 110 * sc, sr = 72 * sc;
    g.fillStyle = px(0xffd740);
    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = px(0xffd740); g.lineWidth = 7 * sc;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      g.beginPath();
      g.moveTo(sx + Math.cos(a) * (sr + 10 * sc), sy + Math.sin(a) * (sr + 10 * sc));
      g.lineTo(sx + Math.cos(a) * (sr + 30 * sc), sy + Math.sin(a) * (sr + 30 * sc));
      g.stroke();
    }
    // Sun face
    g.fillStyle = px(0xfffbe0);
    g.beginPath(); g.arc(sx - 20 * sc, sy - 12 * sc, 12 * sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(sx + 20 * sc, sy - 12 * sc, 12 * sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0x2a1a00);
    g.beginPath(); g.arc(sx - 18 * sc, sy - 10 * sc, 6 * sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(sx + 22 * sc, sy - 10 * sc, 6 * sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0xaa6030);
    g.beginPath(); g.moveTo(sx, sy + 6 * sc); g.lineTo(sx - 10 * sc, sy + 22 * sc); g.lineTo(sx + 10 * sc, sy + 22 * sc); g.closePath(); g.fill();
    g.strokeStyle = px(0x7a3a00); g.lineWidth = 4 * sc;
    g.beginPath(); g.arc(sx, sy + 14 * sc, 20 * sc, 0.15, Math.PI - 0.15); g.stroke();

    // --- TIGER body centred at y=290, x=240 ---
    const tigerColor = 0xe8943a;
    const stripeColor = 0x8a4a1a;
    const tby = 290 * sc;
    const tbx = 240 * sc;

    // Body ellipse
    g.fillStyle = px(tigerColor);
    g.beginPath(); g.ellipse(tbx, tby, 170 * sc, 65 * sc, 0, 0, Math.PI * 2); g.fill();

    // Head facing right
    const thx = 420 * sc, thy = tby - 16 * sc;
    g.beginPath(); g.arc(thx, thy, 58 * sc, 0, Math.PI * 2); g.fill();

    // Ears
    g.beginPath(); g.moveTo(thx - 28 * sc, thy - 44 * sc); g.lineTo(thx - 40 * sc, thy - 82 * sc); g.lineTo(thx - 8 * sc, thy - 52 * sc); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(thx + 8 * sc, thy - 46 * sc); g.lineTo(thx + 28 * sc, thy - 82 * sc); g.lineTo(thx + 38 * sc, thy - 46 * sc); g.closePath(); g.fill();

    // Eyes
    g.fillStyle = px(0xffee88);
    g.beginPath(); g.arc(thx - 22 * sc, thy - 6 * sc, 13 * sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(thx + 12 * sc, thy - 6 * sc, 13 * sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = px(0x1a1a00);
    g.beginPath(); g.arc(thx - 20 * sc, thy - 4 * sc, 6 * sc, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(thx + 14 * sc, thy - 4 * sc, 6 * sc, 0, Math.PI * 2); g.fill();

    // Nose + mouth
    g.fillStyle = px(0xcc6633);
    g.beginPath(); g.moveTo(thx, thy + 16 * sc); g.lineTo(thx - 11 * sc, thy + 4 * sc); g.lineTo(thx + 11 * sc, thy + 4 * sc); g.closePath(); g.fill();
    g.strokeStyle = px(0x8a3a10); g.lineWidth = 3 * sc;
    g.beginPath(); g.moveTo(thx, thy + 16 * sc); g.lineTo(thx - 11 * sc, thy + 28 * sc); g.stroke();
    g.beginPath(); g.moveTo(thx, thy + 16 * sc); g.lineTo(thx + 11 * sc, thy + 28 * sc); g.stroke();

    // Body stripes
    g.fillStyle = px(stripeColor);
    for (const [bx, bw, bh, rot] of [
      [tbx - 80 * sc, 18 * sc, 68 * sc, -0.15],
      [tbx - 30 * sc, 18 * sc, 72 * sc, -0.05],
      [tbx + 20 * sc, 18 * sc, 72 * sc,  0.05],
      [tbx + 72 * sc, 18 * sc, 66 * sc,  0.15],
    ] as [number, number, number, number][]) {
      g.save(); g.translate(bx, tby); g.rotate(rot);
      g.fillRect(-bw / 2, -bh / 2, bw, bh);
      g.restore();
    }

    // Tail curling up from back
    g.strokeStyle = px(tigerColor); g.lineWidth = 20 * sc;
    g.beginPath(); g.moveTo(tbx - 160 * sc, tby + 12 * sc); g.quadraticCurveTo(tbx - 190 * sc, tby - 12 * sc, tbx - 200 * sc, tby - 60 * sc); g.stroke();
    g.strokeStyle = px(stripeColor); g.lineWidth = 8 * sc;
    g.beginPath(); g.moveTo(tbx - 160 * sc, tby + 12 * sc); g.quadraticCurveTo(tbx - 190 * sc, tby - 12 * sc, tbx - 200 * sc, tby - 60 * sc); g.stroke();
    g.fillStyle = px(0x3a1a00);
    g.beginPath(); g.arc(tbx - 200 * sc, tby - 64 * sc, 14 * sc, 0, Math.PI * 2); g.fill();

    // Legs
    g.fillStyle = px(tigerColor);
    for (const lx of [tbx - 110 * sc, tbx - 60 * sc, tbx + 40 * sc, tbx + 90 * sc]) {
      g.beginPath(); g.roundRect(lx, tby + 50 * sc, 28 * sc, 85 * sc, 10 * sc); g.fill();
      g.fillStyle = px(0xd0783a);
      g.beginPath(); g.ellipse(lx + 14 * sc, tby + 136 * sc, 20 * sc, 12 * sc, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = px(tigerColor);
    }

    // Gold inner border only (no outer black frame)
    g.strokeStyle = px(0xd4af37); g.lineWidth = 8 * sc;
    g.strokeRect(10 * sc, 10 * sc, S - 20 * sc, S - 20 * sc);
  }

  const [cv, g] = canvas(BASE, BASE, 0x1c5d99, draw, false); // priority=false — stays 1x
  draw(g, BASE, BASE);
  const t2 = toTexture(cv);
  t2.wrapS = t2.wrapT = THREE.ClampToEdgeWrapping;
  return t2;
}

/* ================================================================ */
/* PR#1 portal helpers — seeded LCG replaces all Math.random        */
/* ================================================================ */

/**
 * LCG seeded random — replaces Math.random in all portal generators.
 * Park-Miller: s = (s * 16807) % 2147483647
 */
function makeLcg(seed: number) {
  let s = seed | 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/**
 * Persian pointed arch path (canvas coords, y grows downward).
 * Arch spans [cx-aw/2, cx+aw/2], base at baseY, springs at springY, apex at apexY.
 */
function portalArchPath(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number, aw: number, springY: number, apexY: number,
) {
  const hw = aw / 2;
  ctx.beginPath();
  ctx.moveTo(cx - hw, baseY);
  ctx.lineTo(cx - hw, springY);
  ctx.bezierCurveTo(
    cx - hw, springY - (springY - apexY) * 0.55,
    cx - aw * 0.30, apexY + (springY - apexY) * 0.18, cx, apexY);
  ctx.bezierCurveTo(
    cx + aw * 0.30, apexY + (springY - apexY) * 0.18,
    cx + hw, springY - (springY - apexY) * 0.55, cx + hw, springY);
  ctx.lineTo(cx + hw, baseY);
  ctx.closePath();
}

/** Eight-pointed star (khatam) — basic girih mosaic unit. */
function portalStar8(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number, color: string, rot = Math.PI / 8,
) {
  const r = R * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = rot + (i * Math.PI) / 8;
    const rad = i % 2 === 0 ? R : r;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Blocky pseudo-kufic calligraphy strip on cobalt. Seeded — no Math.random. */
function portalDrawKuficBand(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 1,
) {
  ctx.save();
  ctx.fillStyle = px(C_COBALT); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = px(C_WHITE);
  const rnd = makeLcg(seed);
  const bw = h * 0.16;
  for (let gx = x + h * 0.4; gx < x + w - h * 0.4; gx += h * 0.55) {
    const tall = h * (0.45 + rnd() * 0.35);
    ctx.fillRect(gx, y + h * 0.85 - tall, bw, tall);
    if (rnd() > 0.45) ctx.fillRect(gx, y + h * 0.85 - bw, h * 0.38, bw);
    if (rnd() > 0.7)  ctx.fillRect(gx, y + h * 0.85 - tall, h * 0.3, bw);
  }
  ctx.fillStyle = px(C_GOLD);
  ctx.fillRect(x, y, w, h * 0.06);
  ctx.fillRect(x, y + h * 0.94, w, h * 0.06);
  ctx.restore();
}

/** Band of 8-point stars — used to frame great portals. */
function portalDrawGirihBand(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, vertical: boolean,
) {
  ctx.save();
  ctx.fillStyle = px(C_COBALT); ctx.fillRect(x, y, w, h);
  const step = vertical ? w : h;
  const n = Math.max(1, Math.round((vertical ? h : w) / step));
  for (let i = 0; i < n; i++) {
    const cx = vertical ? x + w / 2 : x + step * (i + 0.5);
    const cy = vertical ? y + step * (i + 0.5) : y + h / 2;
    portalStar8(ctx, cx, cy, step * 0.42, i % 2 ? px(C_TURQUOISE) : px(C_WHITE));
    portalStar8(ctx, cx, cy, step * 0.20, px(C_GOLD));
  }
  ctx.restore();
}

/** Square-kufic block motif tiled over the area. No random. */
const SQ_KUFIC = [
  '############.',
  '#..........#.',
  '#.########.#.',
  '#.#......#.#.',
  '#.#.####.#.#.',
  '#.#.#..#...#.',
  '#.#.#.#####..',
  '#...#......#.',
  '#.#########.',
  '#...........',
  '#############',
  '.............',
];
function portalDrawSquareKufic(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fg = px(C_WHITE), bg = px(C_COBALT), accent = px(C_TURQUOISE),
) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  const rows = SQ_KUFIC.length, cols = 13;
  const cell = Math.max(4, Math.min(w, h) / 14);
  for (let ty = 0; ty * cell * rows < h + cell * rows; ty++) {
    for (let tx = 0; tx * cell * cols < w + cell * cols; tx++) {
      const col = (tx + ty) % 2 ? fg : accent;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          if (SQ_KUFIC[j][i] !== '#') continue;
          ctx.fillStyle = col;
          ctx.fillRect(x + tx * cell * cols + i * cell, y + ty * cell * rows + j * cell, cell * 0.92, cell * 0.92);
        }
      }
    }
  }
  ctx.restore();
}

/** Vertical pseudo-kufic inscription strip (rotated). */
function portalDrawKuficBandV(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 1,
) {
  const tmp = document.createElement('canvas');
  tmp.width = Math.ceil(h); tmp.height = Math.ceil(w);
  portalDrawKuficBand(tmp.getContext('2d')!, 0, 0, tmp.width, tmp.height, seed);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(tmp, -h / 2, -w / 2);
  ctx.restore();
}

/* ======================== Tympanum art ========================= */

/** Ulugh Beg: constellation of girih stars ("the sky of astronomers"). */
function drawStarsTympanum(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = px(C_COBALT); ctx.fillRect(x, y, w, h);
  const rnd = makeLcg(13);
  // faint gold lattice
  ctx.strokeStyle = 'rgba(217,181,69,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(x + rnd() * w, y);
    ctx.lineTo(x + rnd() * w, y + h);
    ctx.stroke();
  }
  // constellation (biased to sides since arch cuts the middle)
  const place: [number, number, number, number][] = [];
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    const fx = 0.5 + side * (0.18 + rnd() * 0.32);
    const fy = i < 10 ? 0.12 + rnd() * 0.3 : 0.12 + rnd() * 0.8;
    place.push([fx, fy, 0.07 + rnd() * 0.085, rnd() * Math.PI]);
  }
  for (let i = 0; i < 8; i++) place.push([0.2 + rnd() * 0.6, 0.05 + rnd() * 0.22, 0.05 + rnd() * 0.06, rnd()]);
  place.forEach(([fx, fy, fr, rot], i) => {
    const col = [px(C_WHITE), px(C_TURQUOISE_HI), px(C_GOLD)][i % 3];
    portalStar8(ctx, x + fx * w, y + fy * h, fr * h * 1.6, col, rot);
    portalStar8(ctx, x + fx * w, y + fy * h, fr * h * 0.6, i % 3 === 2 ? px(C_COBALT) : px(C_GOLD), rot);
  });
  ctx.restore();
}

/** Sher-Dor: full tiger w/ doe + human-faced sun. Seeded — no Math.random. */
function portalDrawTiger(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * dir, s);

  // white doe
  ctx.save();
  ctx.translate(118, 4);
  ctx.fillStyle = px(C_WHITE);
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 11, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(24, -12, 8, 6, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = px(C_WHITE); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  for (const [lx, a] of [[-18, 2.6], [-10, 2.9], [12, 0.5], [20, 0.2]] as [number, number][]) {
    ctx.beginPath(); ctx.moveTo(lx, 6);
    ctx.lineTo(lx + Math.cos(a) * 18, 6 + Math.sin(a) * 16); ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, -18); ctx.lineTo(34, -28); ctx.stroke();
  ctx.restore();

  // human-faced sun
  ctx.save();
  ctx.translate(-18, -52);
  ctx.fillStyle = px(C_GOLD);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.09) * 30, Math.sin(a - 0.09) * 30);
    ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
    ctx.lineTo(Math.cos(a + 0.09) * 30, Math.sin(a + 0.09) * 30);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#e8c06a';
  ctx.beginPath(); ctx.arc(0, 0, 31, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a5520'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-10, -4, 5.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.beginPath(); ctx.arc(10, -4, 5.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-15, -12); ctx.quadraticCurveTo(-9, -16, -3, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, -12); ctx.quadraticCurveTo(9, -16, 15, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-2, 6); ctx.lineTo(2, 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 9, 7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.restore();

  // tiger body
  ctx.fillStyle = px(C_TIGER);
  ctx.beginPath(); ctx.ellipse(0, 0, 58, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = px(C_TIGER); ctx.lineWidth = 10; ctx.lineCap = 'round';
  for (const [lx, dx, dy] of [[-40, -26, 26], [-28, -10, 30], [30, 18, 28], [44, 32, 20]] as [number, number, number][]) {
    ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + dx, 12 + dy); ctx.stroke();
  }
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-55, -6); ctx.quadraticCurveTo(-86, -20, -78, -44); ctx.stroke();
  ctx.fillStyle = px(C_TIGER);
  ctx.beginPath(); ctx.arc(60, -10, 17, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(70, -8); ctx.lineTo(88, -2); ctx.lineTo(70, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = px(C_WHITE);
  ctx.beginPath(); ctx.moveTo(70, -4); ctx.lineTo(83, -1); ctx.lineTo(70, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = px(C_TIGER);
  ctx.beginPath(); ctx.moveTo(52, -24); ctx.lineTo(57, -34); ctx.lineTo(63, -24); ctx.closePath(); ctx.fill();
  ctx.fillStyle = px(C_STRIPE);
  ctx.beginPath(); ctx.arc(63, -14, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = px(C_STRIPE); ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = -4; i <= 4; i++) {
    const sx = i * 11;
    ctx.beginPath();
    ctx.moveTo(sx, -20 + Math.abs(i));
    ctx.quadraticCurveTo(sx - 4, 0, sx, 16 - Math.abs(i));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,246,227,0.85)';
  ctx.beginPath(); ctx.ellipse(4, 14, 40, 7, 0, 0, Math.PI); ctx.fill();
  ctx.restore();
}

function drawTigerTympanum(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#caa45c'; ctx.fillRect(x, y, w, h);
  const rnd = makeLcg(31);
  for (let i = 0; i < 60; i++) {
    const fx = x + rnd() * w, fy = y + rnd() * h;
    ctx.strokeStyle = 'rgba(30,95,168,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, 7 + rnd() * 8, rnd() * 6, rnd() * 6 + 2.2); ctx.stroke();
    ctx.fillStyle = rnd() > 0.5 ? px(C_TURQUOISE) : px(C_COBALT);
    ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  const sc = h / 280;
  portalDrawTiger(ctx, x + w * 0.155, y + h * 0.58, sc,  1);
  portalDrawTiger(ctx, x + w * 0.845, y + h * 0.58, sc, -1);
  ctx.restore();
}

/** Tilya-Kori: gilt rosettes and arabesque scrollwork on cobalt. Seeded. */
function drawGoldTympanum(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = px(C_COBALT); ctx.fillRect(x, y, w, h);
  const rnd = makeLcg(5);
  ctx.strokeStyle = 'rgba(217,181,69,0.85)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const fx = x + rnd() * w, fy = y + rnd() * h, r = 10 + rnd() * 22;
    ctx.beginPath(); ctx.arc(fx, fy, r, rnd() * 6, rnd() * 6 + 3.5); ctx.stroke();
  }
  const rosette = (cx: number, cy: number, R: number) => {
    ctx.fillStyle = px(C_GOLD);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, R * 0.34, R * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = px(C_TURQUOISE_HI);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = px(C_GOLD);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.13, 0, Math.PI * 2); ctx.fill();
  };
  rosette(x + w * 0.5,  y + h * 0.42, h * 0.34);
  rosette(x + w * 0.18, y + h * 0.6,  h * 0.2);
  rosette(x + w * 0.82, y + h * 0.6,  h * 0.2);
  for (let i = 0; i < 7; i++) rosette(x + (0.08 + rnd() * 0.84) * w, y + (0.12 + rnd() * 0.2) * h, h * 0.08);
  ctx.restore();
}

export type PortalVariant = 'ulughbeg' | 'sherdor' | 'tilyakori';

const TYMPANUM_BY_VARIANT: Record<PortalVariant, (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void> = {
  ulughbeg:  drawStarsTympanum,
  sherdor:   drawTigerTympanum,
  tilyakori: drawGoldTympanum,
};

/**
 * Front face of the great portal screen.
 * Proportions: aw=0.55w, spring=0.42h, apex=0.74h.
 * All coords are relative to (w,h) so the draw closure is resolution-independent.
 * Priority=true → 2x re-rasterization on zoom-in.
 */
export function portalTexture(variant: PortalVariant, wM: number, hM: number): THREE.CanvasTexture {
  const W = 1024, H = Math.round(W * hM / wM);

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = px(C_COBALT); ctx.fillRect(0, 0, w, h);
    // outer gilt rim
    ctx.fillStyle = px(C_GOLD); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = px(C_COBALT); ctx.fillRect(w * 0.012, h * 0.008, w * 0.976, h);

    // girih bands left/top/right
    const band = w * 0.115;
    portalDrawGirihBand(ctx, w * 0.02, h * 0.015, band, h - h * 0.015, true);
    portalDrawGirihBand(ctx, w - w * 0.02 - band, h * 0.015, band, h - h * 0.015, true);
    portalDrawGirihBand(ctx, w * 0.02 + band, h * 0.015, w - (w * 0.02 + band) * 2, band * 0.8, false);

    // calligraphy strip under top band
    portalDrawKuficBand(ctx, w * 0.02 + band, h * 0.015 + band * 0.8, w - (w * 0.02 + band) * 2, band * 0.5, variant.length);

    // arch geometry in canvas space (y=0 = top, y=h = bottom / arch base)
    const aw = w * 0.55;
    const springY = h * (1 - 0.42);
    const apexY   = h * (1 - 0.74);

    // square-kufic tile fields flanking the arch
    const fieldX0 = w * 0.02 + band, fieldW = w * 0.092;
    portalDrawSquareKufic(ctx, fieldX0, springY, fieldW, h - springY);
    portalDrawSquareKufic(ctx, w - fieldX0 - fieldW, springY, fieldW, h - springY, px(C_TURQUOISE_HI));

    // tympanum mosaic — per-variant signature art
    const tymTop = h * 0.075 + band * 1.3;
    TYMPANUM_BY_VARIANT[variant](ctx, w * 0.02 + band, tymTop, w - (w * 0.02 + band) * 2, apexY - tymTop + h * 0.10);

    // inscription frame hugging the arch
    const insW = w * 0.045;
    const insTop = apexY - h * 0.02 - insW * 1.4;
    portalDrawKuficBandV(ctx, w / 2 - aw / 2 - w * 0.025 - insW, insTop + insW * 1.4, insW, h - insTop - insW * 1.4, 11);
    portalDrawKuficBandV(ctx, w / 2 + aw / 2 + w * 0.025,         insTop + insW * 1.4, insW, h - insTop - insW * 1.4, 12);
    portalDrawKuficBand(ctx, w / 2 - aw / 2 - w * 0.025 - insW, insTop, aw + w * 0.05 + insW * 2, insW * 1.4, 13);

    // turquoise + gold archivolt rings
    portalArchPath(ctx, w / 2, h, aw + w * 0.05, springY, apexY - h * 0.018);
    ctx.fillStyle = px(C_TURQUOISE); ctx.fill();
    portalArchPath(ctx, w / 2, h, aw + w * 0.022, springY, apexY - h * 0.008);
    ctx.fillStyle = px(C_GOLD); ctx.fill();

    // dark arch opening (painted as backup; real hole cut by geometry)
    portalArchPath(ctx, w / 2, h, aw, springY, apexY);
    ctx.fillStyle = px(C_NIGHT); ctx.fill();
  }

  const [cv, g] = canvas(W, H, C_COBALT, draw, true);
  draw(g, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / wM, 1 / hM);
  t.offset.set(0.5, 0);
  t.anisotropy = 8;
  textureRegistry.addTexture(cv, t);
  return t;
}

/**
 * Back wall of the recessed iwan: tympanum panel + star dado + double door.
 * Priority=true → 2x re-rasterization on zoom.
 */
export function iwanTexture(variant: PortalVariant): THREE.CanvasTexture {
  const W = 768, H = 1024;

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = px(C_COBALT_DARK); ctx.fillRect(0, 0, w, h);
    TYMPANUM_BY_VARIANT[variant](ctx, w * 0.06, h * 0.05, w * 0.88, h * 0.42);
    ctx.strokeStyle = px(C_GOLD); ctx.lineWidth = 8;
    ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.42);
    // star dado
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 3; j++)
        portalStar8(ctx, w * (0.12 + i * 0.19), h * (0.55 + j * 0.13), w * 0.045,
          (i + j) % 2 ? px(C_TURQUOISE) : px(C_WHITE));
    // carved double door under gilt arch frame
    const dw = w * 0.34, dx = (w - dw) / 2;
    ctx.fillStyle = px(C_GOLD);
    ctx.fillRect(dx - w * 0.025, h * 0.62, dw + w * 0.05, h * 0.38);
    portalArchPath(ctx, w / 2, h, dw, h * 0.78, h * 0.66);
    ctx.fillStyle = '#3a2a16'; ctx.fill();
    ctx.strokeStyle = '#1f1609'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.70); ctx.lineTo(w / 2, h); ctx.stroke();
    for (let j = 0; j < 4; j++) {
      ctx.strokeRect(dx + dw * 0.08, h * (0.74 + j * 0.062), dw * 0.34, h * 0.05);
      ctx.strokeRect(dx + dw * 0.58, h * (0.74 + j * 0.062), dw * 0.34, h * 0.05);
    }
  }

  const [cv, g] = canvas(W, H, C_COBALT_DARK, draw, true);
  draw(g, W, H);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  textureRegistry.addTexture(cv, t);
  return t;
}

/**
 * Rope-column texture: 45° seamless stripes (sand/cobalt/sand/turquoise).
 * Wraps into a spiral when applied to a cylinder.
 */
export function ropeTexture(): THREE.CanvasTexture {
  const S = 256;

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cols = [px(C_SAND), px(C_COBALT), px(C_SAND), px(C_TURQUOISE)];
    const period = w / 4;
    ctx.lineWidth = period / Math.SQRT2 + 1;
    for (let c = -w; c < 2 * w + h; c += period) {
      ctx.strokeStyle = cols[(((c / period) % 4) + 4) % 4];
      ctx.beginPath();
      ctx.moveTo(c + h,     -h);
      ctx.lineTo(c - 2 * h,  2 * h);
      ctx.stroke();
    }
  }

  const [cv, g] = canvas(S, S, C_SAND, draw, false);
  draw(g, S, S);
  return toTexture(cv);
}
