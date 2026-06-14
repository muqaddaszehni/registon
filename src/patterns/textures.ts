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
 * Banna'i (bannai) glazed-brick lattice — authentic square-Kufic brick calligraphy.
 * 1024² tileable canvas. Fine buff-brick coursing underneath. Diagonal grid of
 * glazed-cobalt bricks form geometric "brick calligraphy" angular forms.
 * bg = buff-brick field, line = cobalt glazed brick, motif = turquoise accent.
 */
export function bannai(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    const rnd = lcgBannai(37);
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // ── Fine buff-brick coursing underneath (individual bricks visible) ────
    const brickH = Math.round(S * 0.0195); // ~20px at 1024
    const brickW = Math.round(S * 0.058);  // ~60px at 1024
    g.strokeStyle = 'rgba(110,80,40,0.25)';
    g.lineWidth = Math.max(1, Math.round(S * 0.0012));
    for (let y = 0; y < S; y += brickH) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      const row = Math.round(y / brickH);
      const xOff = row % 2 ? 0 : brickW / 2;
      for (let x = xOff; x < S + brickW; x += brickW) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + brickH); g.stroke();
      }
    }

    // ── Subtle tonal variation across the buff field (hand-set brick look) ─
    for (let i = 0; i < Math.round(S * S / 4000); i++) {
      const bx = rnd() * S, by = rnd() * S;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,170,0.06)' : 'rgba(100,65,25,0.06)';
      g.fillRect(bx, by, Math.round(S * 0.028), Math.round(S * 0.012));
    }

    // ── Glazed-brick diagonal lattice with angular Kufic forms ────────────
    // Cell size: diamond spans cellSize along each diagonal axis
    const cellSize = Math.round(S * 0.25); // 4 diamonds per tile
    const halfCell = cellSize / 2;
    // Glazed-brick line width: thicker for brick depth
    const lineW = Math.max(3, Math.round(S * 0.014));

    // Draw diagonal grid lines (glazed cobalt brick rows)
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
    // Family 2: −45°
    for (let i = -count; i < count * 2; i++) {
      const offset = i * step;
      g.beginPath();
      g.moveTo(offset + S, -S);
      g.lineTo(offset - S, S * 2);
      g.stroke();
    }

    // ── Angular square-Kufic motifs inside each diamond cell ─────────────
    // Authentic banna'i: stepped cross forms + flanking bar elements
    // that read as geometric "brick calligraphy" at distance.
    const ms = Math.round(cellSize * 0.22);   // main cross arm half-length
    const bw2 = Math.round(ms * 0.42);        // arm width

    for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
      for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

        // Alternate cells: cobalt cross vs turquoise diamond (authentic ratio ~70/30)
        const useTurquoise = (ix + iy) % 3 === 0;
        const fillCol = useTurquoise ? px(motif) : px(line);
        g.fillStyle = fillCol;

        // Central diamond (rotated square) — the core kufic element
        g.beginPath();
        g.moveTo(cx,      cy - ms);
        g.lineTo(cx + ms, cy);
        g.lineTo(cx,      cy + ms);
        g.lineTo(cx - ms, cy);
        g.closePath();
        g.fill();

        // Four angular "arm" bars extending from diamond corners — stepped Kufic arms
        const armLen = Math.round(cellSize * 0.32);
        const armW = Math.round(bw2 * 0.85);
        for (const [da, perpSign] of [[Math.PI / 4, 1], [3 * Math.PI / 4, -1], [5 * Math.PI / 4, 1], [7 * Math.PI / 4, -1]] as [number, number][]) {
          const nx = Math.cos(da), ny = Math.sin(da);
          const px2 = -ny * perpSign, py2 = nx * perpSign;
          const startX = cx + nx * ms * 0.85;
          const startY = cy + ny * ms * 0.85;
          g.save();
          g.translate(startX, startY);
          g.rotate(da + Math.PI / 4);
          // Main arm
          g.fillRect(-armW / 2, 0, armW, armLen * 0.55);
          // Step notch on one side (creates the Kufic "step" appearance)
          g.fillStyle = useTurquoise ? px(motif) : px(line);
          g.fillRect(-armW / 2, armLen * 0.3, armW * (1 + perpSign * 0.5), armW * 0.55);
          g.restore();
          void px2; void py2; // suppress unused warnings
        }

        // Thin outline stroke for depth/crispness
        g.strokeStyle = 'rgba(10,20,50,0.18)';
        g.lineWidth = Math.max(1, Math.round(S * 0.0015));
        g.beginPath();
        g.moveTo(cx,      cy - ms);
        g.lineTo(cx + ms, cy);
        g.lineTo(cx,      cy + ms);
        g.lineTo(cx - ms, cy);
        g.closePath();
        g.stroke();
      }
    }

    // ── Subtle glaze specular streaks (hand-glazed look) ──────────────────
    const rnd2 = lcgBannai(91);
    g.globalAlpha = 0.07;
    for (let i = 0; i < 18; i++) {
      const sx = rnd2() * S, sy = rnd2() * S;
      const len = S * (0.04 + rnd2() * 0.06);
      const a = -Math.PI / 4 + (rnd2() - 0.5) * 0.3;
      const grad = g.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grad;
      g.lineWidth = Math.max(1, Math.round(S * 0.003));
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Module-level seeded LCG for bannai (avoids closure conflict with outer lcg)
  function lcgBannai(seed: number) {
    let s = seed | 1;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
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
 * Convincing pseudo-thuluth/kufic calligraphy band.
 * 1024×256. Varied-weight vertical strokes with ligatures, dot clusters,
 * baseline connectors, diamond diacritics. White on cobalt, gold frame.
 */
export function calligraphyBand(bg: number, fg: number): THREE.CanvasTexture {
  const BASE_W = 1024, BASE_H = 256;

  // Glyph data: [xFrac, heightFrac, hasCross, hasDot, crossWFrac, dotCount, strokeWeight]
  // strokeWeight: 1=thin, 2=medium, 3=bold — mirrors thuluth's varied-weight strokes
  const glyphDataFrac: [number, number, boolean, boolean, number, number, number][] = [
    [42/1024,  155/256, true,  false, 85/1024,  0, 3],
    [75/1024,  95/256,  false, true,  0,         2, 1],
    [108/1024, 172/256, true,  false, 72/1024,  0, 2],
    [148/1024, 115/256, false, false, 55/1024,  1, 1],
    [178/1024, 148/256, true,  true,  62/1024,  0, 3],
    [222/1024, 85/256,  false, true,  0,         3, 1],
    [255/1024, 162/256, true,  false, 92/1024,  0, 2],
    [298/1024, 128/256, false, true,  0,         1, 1],
    [330/1024, 108/256, false, false, 52/1024,  0, 2],
    [365/1024, 168/256, true,  false, 78/1024,  0, 3],
    [412/1024, 78/256,  false, true,  0,         2, 1],
    [448/1024, 158/256, true,  false, 88/1024,  0, 2],
    [485/1024, 122/256, false, false, 62/1024,  1, 1],
    [520/1024, 142/256, true,  true,  72/1024,  0, 3],
    [562/1024, 88/256,  false, false, 0,         3, 1],
    [598/1024, 168/256, true,  false, 98/1024,  0, 2],
    [640/1024, 118/256, false, true,  0,         1, 1],
    [672/1024, 102/256, false, false, 52/1024,  0, 2],
    [705/1024, 162/256, true,  false, 82/1024,  0, 3],
    [755/1024, 82/256,  false, true,  0,         2, 1],
    [788/1024, 155/256, true,  false, 78/1024,  0, 2],
    [825/1024, 128/256, false, false, 62/1024,  0, 1],
    [856/1024, 142/256, true,  true,  72/1024,  1, 3],
    [898/1024, 88/256,  false, false, 0,         3, 1],
    [932/1024, 162/256, true,  false, 92/1024,  0, 2],
    [970/1024, 108/256, false, true,  0,         1, 1],
  ];

  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = px(bg); g.fillRect(0, 0, W, H);

    // ── Gold outer frame (thin line on top and bottom edges) ───────────────
    const goldH = Math.max(2, Math.round(H * (5 / 256)));
    g.fillStyle = '#d9b545';
    g.fillRect(0, 0, W, goldH);
    g.fillRect(0, H - goldH, W, goldH);

    // ── White solid top and bottom bands ──────────────────────────────────
    const borderH = Math.round(H * (14 / 256));
    g.fillStyle = px(fg);
    g.fillRect(0, goldH, W, borderH);
    g.fillRect(0, H - goldH - borderH, W, borderH);

    // ── Inner double-rule lines ────────────────────────────────────────────
    const ibInset = goldH + borderH + Math.round(H * (5 / 256));
    g.strokeStyle = px(fg);
    g.lineWidth = Math.max(1, Math.round(H * (3 / 256)));
    g.strokeRect(ibInset * 0.5, ibInset, W - ibInset, H - ibInset * 2);
    // Second thinner rule 4px inside
    const rule2 = ibInset + Math.round(H * (5 / 256));
    g.lineWidth = Math.max(1, Math.round(H * 0.006));
    g.strokeRect(rule2 * 0.5, rule2, W - rule2, H - rule2 * 2);

    const baseY = H - Math.round(H * (32 / 256)); // baseline of strokes
    const baseThick = Math.max(3, Math.round(H * (8 / 256)));

    // ── Baseline thickening (the characteristic thuluth baseline rule) ────
    g.fillStyle = px(fg);
    g.fillRect(ibInset * 0.5, baseY, W - ibInset, baseThick);

    // ── Main glyph strokes ────────────────────────────────────────────────
    for (const [xFrac, hFrac, hasTopCross, hasDot, crossWFrac, dotCount, strokeWeight] of glyphDataFrac) {
      const x = Math.round(xFrac * W);
      const strokeH = Math.round(hFrac * H);
      const crossW = Math.round(crossWFrac * W);
      // Varied weights: thin=8px, medium=13px, bold=18px (at 256px height)
      const swBase = [8, 13, 18][strokeWeight - 1];
      const sw = Math.max(4, Math.round(H * (swBase / 256)));
      const topY = baseY - strokeH;

      // Main vertical stroke: tapered (wider base, narrow top) — thuluth style
      g.fillStyle = px(fg);
      g.beginPath();
      g.moveTo(x - sw * 0.65, baseY + baseThick * 0.3);
      g.lineTo(x - sw * 0.42, topY + sw * 0.3);
      g.quadraticCurveTo(x - sw * 0.2, topY, x, topY - sw * 0.1);
      g.quadraticCurveTo(x + sw * 0.2, topY, x + sw * 0.42, topY + sw * 0.3);
      g.lineTo(x + sw * 0.65, baseY + baseThick * 0.3);
      g.closePath();
      g.fill();

      // Horizontal crossbar (alif head / lam ascending bar)
      if (hasTopCross && crossW > 0) {
        const crossH = Math.max(3, Math.round(H * (9 / 256)));
        const crossY = topY - Math.round(H * (4 / 256));
        // Main crossbar
        g.fillRect(x - crossW / 2, crossY - crossH, crossW, crossH);
        // Serif wedges at both ends (thuluth terminal)
        const sfW = Math.max(2, Math.round(H * (6 / 256)));
        const sfH = Math.max(3, Math.round(H * (10 / 256)));
        g.beginPath();
        g.moveTo(x - crossW / 2, crossY - crossH);
        g.lineTo(x - crossW / 2 - sfW, crossY - crossH - sfH * 0.3);
        g.lineTo(x - crossW / 2 - sfW, crossY);
        g.lineTo(x - crossW / 2, crossY);
        g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(x + crossW / 2, crossY - crossH);
        g.lineTo(x + crossW / 2 + sfW, crossY - crossH - sfH * 0.3);
        g.lineTo(x + crossW / 2 + sfW, crossY);
        g.lineTo(x + crossW / 2, crossY);
        g.closePath(); g.fill();
      }

      // Dot accent above stroke (single or clustered)
      if (hasDot || dotCount > 0) {
        const dotR = Math.max(3, Math.round(H * (6.5 / 256)));
        const dotY = topY - Math.round(H * (20 / 256));
        const totalDots = hasDot ? Math.max(1, dotCount) : dotCount;
        if (totalDots === 1) {
          // Single dot
          g.beginPath(); g.arc(x, dotY, dotR, 0, Math.PI * 2); g.fill();
        } else if (totalDots === 2) {
          // Two dots side by side
          g.beginPath(); g.arc(x - dotR * 1.5, dotY, dotR, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x + dotR * 1.5, dotY, dotR, 0, Math.PI * 2); g.fill();
        } else if (totalDots === 3) {
          // Three dots triangle
          g.beginPath(); g.arc(x, dotY - dotR * 1.2, dotR, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x - dotR * 1.5, dotY + dotR * 0.5, dotR, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x + dotR * 1.5, dotY + dotR * 0.5, dotR, 0, Math.PI * 2); g.fill();
        }
      }

      // ── Ligature connector (curved link to adjacent glyph) ────────────
      // Only on medium/bold strokes: a sweeping diagonal tab reaching right
      if (strokeWeight >= 2 && crossWFrac === 0) {
        const ligH = Math.max(3, Math.round(H * (7 / 256)));
        const ligW = Math.round(W * (28 / 1024));
        g.strokeStyle = px(fg);
        g.lineWidth = ligH;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x + sw * 0.5, baseY - Math.round(H * (10 / 256)));
        g.quadraticCurveTo(
          x + ligW * 0.55,
          baseY + Math.round(H * (5 / 256)),
          x + ligW,
          baseY - Math.round(H * (14 / 256)),
        );
        g.stroke();
      }

      // ── Small diamond diacritic (vowel mark) below baseline ───────────
      if (strokeWeight === 1 && hasTopCross) {
        const dm = Math.max(3, Math.round(H * (5 / 256)));
        g.fillStyle = px(fg);
        g.beginPath();
        g.moveTo(x,      baseY + baseThick + dm * 1.5);
        g.lineTo(x + dm, baseY + baseThick + dm * 2.5);
        g.lineTo(x,      baseY + baseThick + dm * 3.5);
        g.lineTo(x - dm, baseY + baseThick + dm * 2.5);
        g.closePath(); g.fill();
      }
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

    // LCG for seeded tonal variation on tiles
    const rndPylon = lcgPylon(73);

    for (let iy = -3; iy < Math.ceil(S / halfCell) + 3; iy++) {
      for (let ix = -3; ix < Math.ceil(S / halfCell) + 3; ix++) {
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;

        // ── Subtle glaze tonal variation: most tiles are motif, ~8% are slightly darker/lighter ──
        const tonalV = rndPylon();
        let fillMotif = px(motif);
        if (tonalV > 0.92) {
          // Slightly darker tile (hand-glazed variation)
          fillMotif = 'rgba(30,60,150,0.9)';
        } else if (tonalV > 0.84) {
          // Lighter turquoise glaze variation
          fillMotif = '#5fe0e0';
        } else if (tonalV > 0.97) {
          // Very rare missing/darker tile (weathering)
          fillMotif = 'rgba(40,40,40,0.85)';
        }

        g.fillStyle = fillMotif;

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

        // ── Specular glaze sheen streak on each star tile ──────────────────
        const sheenA = -Math.PI * 0.3;
        const sheenLen = starR * 0.7;
        const sheenGrad = g.createLinearGradient(
          cx - Math.cos(sheenA) * sheenLen * 0.4,
          cy - Math.sin(sheenA) * sheenLen * 0.4,
          cx + Math.cos(sheenA) * sheenLen,
          cy + Math.sin(sheenA) * sheenLen,
        );
        sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
        sheenGrad.addColorStop(0.4, 'rgba(255,255,255,0.14)');
        sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = sheenGrad;
        g.beginPath();
        for (let p = 0; p < pts * 2; p++) {
          const a = (p * Math.PI / pts) - Math.PI / 2;
          const r = p % 2 === 0 ? starR * 0.95 : innerStarR;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          p === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.restore();

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
        g.fillStyle = fillMotif;
      }
    }

    // ── Subtle glaze tonal wash over entire field ────────────────────────
    // Turquoise/cobalt surfaces get faint tonal variation (hand-glazed look)
    const rndWash = lcgPylon(99);
    g.globalAlpha = 0.04;
    for (let i = 0; i < 24; i++) {
      const wx = rndWash() * S, wy = rndWash() * S;
      const wr = S * (0.03 + rndWash() * 0.05);
      const washGrad = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      washGrad.addColorStop(0, rndWash() > 0.5 ? '#ffffff' : '#002244');
      washGrad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = washGrad;
      g.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    }
    g.globalAlpha = 1;

    g.restore();
  }

  // Module-level seeded LCG for pylonFace
  function lcgPylon(seed: number) {
    let s = seed | 1;
    return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
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

/**
 * Girih strapwork lattice: real interlaced strap ribbons forming 8-point star
 * rosettes with continuous outlined strap lines, connecting polygons between
 * stars (the authentic Islamic geometric strapwork/zelli pattern).
 * Crisp cream/white outlined ribbons over cobalt bg, turquoise/gold polygon infill.
 */
export function girih(bg: number, star: number, accent: number, cells = 4): THREE.CanvasTexture {
  // Use 512px per cell for dense crispness (priority=false so no 2x — stays manageable)
  const CELL = 512;
  const S = CELL * cells; // total canvas size

  function draw(g: CanvasRenderingContext2D, totalW: number, _totalH: number) {
    const cellS = totalW / cells;
    g.fillStyle = px(bg); g.fillRect(0, 0, totalW, totalW);

    // ── Helper: draw one 8-pt star rosette cell ───────────────────────────
    function drawStarCell(ox: number, oy: number) {
      const outerR  = cellS * 0.44;
      const innerR  = cellS * 0.185;
      const strapW  = cellS * 0.075; // width of each strap ribbon
      const strapHalf = strapW / 2;
      const strapR  = outerR * 0.85;  // radius where ribbons emerge from star
      const pts     = 8;

      // ─ 1. Fill polygon fields between stars with accent/infill colour ─────
      // Between 8-pt star points the spaces are: small kite polygons (accent)
      // and large rhombus polygons (turquoise). Draw both.
      // Large rhombus between diagonal neighbours (turquoise)
      g.fillStyle = px(accent);
      for (let i = 0; i < pts; i++) {
        const a0 = (i * Math.PI / 4) - Math.PI / 8;  // midpoint between two outer points
        const a1 = ((i + 1) * Math.PI / 4) - Math.PI / 8;
        const rm = cellS * 0.38; // rhombus reaches ~38% of cellS
        g.beginPath();
        g.moveTo(ox + Math.cos(a0) * outerR * 0.95, oy + Math.sin(a0) * outerR * 0.95);
        g.lineTo(ox + Math.cos(a0) * rm + Math.cos(a1) * rm * 0.35, oy + Math.sin(a0) * rm + Math.sin(a1) * rm * 0.35);
        g.lineTo(ox + Math.cos((a0 + a1) / 2) * cellS * 0.48, oy + Math.sin((a0 + a1) / 2) * cellS * 0.48);
        g.lineTo(ox + Math.cos(a1) * rm + Math.cos(a0) * rm * 0.35, oy + Math.sin(a1) * rm + Math.sin(a0) * rm * 0.35);
        g.closePath();
        g.fill();
      }

      // ─ 2. Fill the 8-pt star body with star colour ────────────────────────
      g.fillStyle = px(star);
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI / pts) - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath();
      g.fill();

      // ─ 3. Draw continuous strap ribbons emerging from star ────────────────
      // Each of the 8 outer points has a strap ribbon that extends outward
      // and connects to neighbours, forming the interlaced strapwork.
      g.strokeStyle = px(star);
      g.lineWidth = strapW;
      g.lineCap = 'round';

      for (let i = 0; i < pts; i++) {
        const aOuter = (i * 2 * Math.PI / pts) - Math.PI / 2; // direction of outer star point

        // Strap goes from the outer point toward the edge of the cell
        const startX = ox + Math.cos(aOuter) * strapR;
        const startY = oy + Math.sin(aOuter) * strapR;
        const endX   = ox + Math.cos(aOuter) * cellS * 0.5;
        const endY   = oy + Math.sin(aOuter) * cellS * 0.5;

        g.beginPath();
        g.moveTo(startX, startY);
        g.lineTo(endX, endY);
        g.stroke();
      }

      // ─ 4. Draw crisp outlined strap lines (the interlaced strap look) ─────
      // Outline all strap edges with a thin dark line for depth
      g.strokeStyle = 'rgba(15,30,70,0.55)';
      g.lineWidth = Math.max(1, strapHalf * 0.3);
      g.lineCap = 'round';

      for (let i = 0; i < pts; i++) {
        const aOuter = (i * 2 * Math.PI / pts) - Math.PI / 2;
        const perpA = aOuter + Math.PI / 2;
        const startR = strapR * 0.72;
        const endR   = cellS * 0.5;

        for (const side of [-1, 1]) {
          const offX = Math.cos(perpA) * strapHalf * side;
          const offY = Math.sin(perpA) * strapHalf * side;
          g.beginPath();
          g.moveTo(ox + Math.cos(aOuter) * startR + offX, oy + Math.sin(aOuter) * startR + offY);
          g.lineTo(ox + Math.cos(aOuter) * endR   + offX, oy + Math.sin(aOuter) * endR   + offY);
          g.stroke();
        }
      }

      // ─ 5. Outline the star itself ─────────────────────────────────────────
      g.strokeStyle = 'rgba(15,30,70,0.5)';
      g.lineWidth = Math.max(1, strapW * 0.20);
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i * Math.PI / pts) - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath(); g.stroke();

      // ─ 6. Gold centre medallion ───────────────────────────────────────────
      g.fillStyle = '#d9b545';
      g.beginPath(); g.arc(ox, oy, cellS * 0.065, 0, Math.PI * 2); g.fill();
      g.fillStyle = px(bg);
      g.beginPath(); g.arc(ox, oy, cellS * 0.032, 0, Math.PI * 2); g.fill();
    }

    // Draw all cells
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const ox = cx * cellS + cellS / 2;
        const oy = cy * cellS + cellS / 2;
        drawStarCell(ox, oy);
      }
    }
  }

  // Priority=false: no 2x (canvas is large — would be 4096² or more)
  const [cv, g] = canvas(S, S, bg, draw, false);
  draw(g, S, S);
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

/** Blocky pseudo-kufic strip. Cobalt bg, white glyphs, gold trim lines.
 * Richer: varied widths, serifs, tabs, dots, baseline rule. */
function drawKuficBandCtx(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  seed = 1, goldTrim = false,
) {
  g.save();
  g.fillStyle = px(REF_COBALT); g.fillRect(x, y, w, h);

  // Gold trim top + bottom
  if (goldTrim) {
    g.fillStyle = px(REF_GOLD);
    g.fillRect(x, y, w, h * 0.06);
    g.fillRect(x, y + h * 0.94, w, h * 0.06);
    // Inner rule lines
    g.strokeStyle = px(REF_GOLD);
    g.lineWidth = Math.max(1, h * 0.018);
    g.beginPath(); g.moveTo(x, y + h * 0.12); g.lineTo(x + w, y + h * 0.12); g.stroke();
    g.beginPath(); g.moveTo(x, y + h * 0.88); g.lineTo(x + w, y + h * 0.88); g.stroke();
  }

  // Baseline rule
  g.fillStyle = px(REF_WHITE);
  g.fillRect(x + h * 0.2, y + h * 0.82, w - h * 0.4, Math.max(2, h * 0.030));

  // Glyph strokes
  const rnd = lcg(seed);
  const bw = h * 0.145;
  let gx = x + h * 0.38;
  while (gx < x + w - h * 0.38) {
    const wMult = rnd() > 0.6 ? 1.55 : (rnd() > 0.4 ? 1.0 : 0.72);
    const gw = bw * wMult;
    const tall = h * (0.40 + rnd() * 0.36);
    const gy = y + h * 0.82 - tall;

    g.fillStyle = px(REF_WHITE);
    g.fillRect(gx, gy, gw, tall);

    // Crossbar tab at top
    if (rnd() > 0.36) {
      const tabW = h * (0.20 + rnd() * 0.22);
      g.fillRect(gx - tabW * 0.25, gy - h * 0.048, gw + tabW * 0.5, h * 0.048);
    }

    // Mid-height connector
    if (rnd() > 0.58) {
      const shelfW = h * (0.16 + rnd() * 0.25);
      g.fillRect(gx, gy + tall * (0.28 + rnd() * 0.32), shelfW, h * 0.036);
    }

    // Dot diacritic
    if (rnd() > 0.65 && tall > h * 0.48) {
      const dr = Math.max(2, h * 0.042);
      g.beginPath(); g.arc(gx + gw / 2, gy - dr * 2.1, dr, 0, Math.PI * 2); g.fill();
    }

    // Serif foot
    if (rnd() > 0.38) {
      const sfW = gw * 1.38;
      g.fillRect(gx - (sfW - gw) / 2, y + h * 0.82, sfW, h * 0.030);
    }

    gx += gw + h * (0.08 + rnd() * 0.18);
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
 * Brick wall with seeded tonal variation + banna'i glazed diamond lattice.
 * Authentic 70/30 buff-brick/blue economy. Fine coursing visible.
 * Tileable 1024².
 */
export function brickWall(bg: number, line: number, motif: number): THREE.CanvasTexture {
  const BASE = 1024;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    const rnd = lcg(42);
    g.fillStyle = px(bg); g.fillRect(0, 0, S, S);

    // Fine buff-brick coursing (smaller bricks = more authentic masonry scale)
    const brickH = Math.round(S * 0.022); // ~22px at 1024 — finer than before
    const brickW = Math.round(S * 0.072); // ~74px at 1024
    g.strokeStyle = 'rgba(110,80,40,0.22)';
    g.lineWidth = Math.max(1, S * 0.0012);
    for (let y = 0; y < S; y += brickH) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      const row = Math.round(y / brickH);
      const xOff = row % 2 ? 0 : brickW / 2;
      for (let x = xOff; x < S + brickW; x += brickW) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + brickH); g.stroke();
      }
    }

    // Seeded tonal patches — buff brick variation
    const patchCount = Math.round(S * S / 3200);
    for (let i = 0; i < patchCount; i++) {
      const px2 = rnd() * S, py2 = rnd() * S;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,235,190,0.055)' : 'rgba(90,60,30,0.055)';
      g.fillRect(px2, py2, Math.round(S * 0.023), Math.round(S * 0.008));
    }

    // Banna'i glazed-brick diamonds — 70/30 buff/blue economy
    // Every 3rd cell in checkerboard gets turquoise; others get cobalt (line)
    const gsize = Math.round(S * 0.0625); // 64/1024
    const rnd2 = lcg(57);
    for (let j = 0; j < S / gsize; j++) {
      for (let i = 0; i < S / gsize; i++) {
        if ((i + j) % 2 === 0) continue; // buff field cells — skip
        const cx2 = i * gsize + gsize / 2, cy2 = j * gsize + gsize / 2;
        const s2 = gsize * 0.30;
        // Occasional turquoise (motif) vs mostly cobalt (line)
        const useTurq = (i * 3 + j * 7) % 5 === 0;
        const outerCol = useTurq ? px(motif) : px(line);
        const innerCol = useTurq ? '#5fe0e0' : px(line); // turquoise hi or cobalt

        g.save();
        g.translate(cx2, cy2); g.rotate(Math.PI / 4);
        g.fillStyle = outerCol;  g.fillRect(-s2, -s2, s2 * 2, s2 * 2);
        g.fillStyle = innerCol;  g.fillRect(-s2 * 0.42, -s2 * 0.42, s2 * 0.84, s2 * 0.84);
        g.restore();

        // Specular sheen on glazed tile
        g.globalAlpha = 0.10;
        const sgrad = g.createLinearGradient(cx2 - s2, cy2 - s2, cx2 + s2 * 0.5, cy2 + s2 * 0.5);
        sgrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        sgrad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sgrad;
        g.save();
        g.translate(cx2, cy2); g.rotate(Math.PI / 4);
        g.fillRect(-s2, -s2, s2 * 2, s2 * 2);
        g.restore();
        g.globalAlpha = 1;

        // Rare weathering: chip/darker tile
        if (rnd2() > 0.94) {
          g.fillStyle = 'rgba(30,20,10,0.25)';
          g.save();
          g.translate(cx2, cy2); g.rotate(Math.PI / 4);
          g.fillRect(-s2 * 0.8, -s2 * 0.8, s2 * 1.6, s2 * 0.4);
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
 * Seamless girih tile with full strapwork: cobalt bg, white 8-point star centre
 * with strap ribbons connecting to turquoise quarter-stars at corners.
 * Outlined ribbons (dark edge lines) give interlaced strapwork depth.
 * Used on pilaster strips + inner arch. 512² for crispness at zoom.
 */
export function girihTile(): THREE.CanvasTexture {
  const S = 512; // raised from 256 for crisper strapwork at zoom

  function draw(g: CanvasRenderingContext2D, w: number, _h: number) {
    g.fillStyle = px(REF_COBALT); g.fillRect(0, 0, w, w);

    const cx = w / 2, cy = w / 2;
    const outerR = w * 0.33;
    const innerR = w * 0.135;
    const strapW = w * 0.072;
    const strapHalf = strapW / 2;
    const pts = 8;

    // ── 1. Fill between-star polygon zones with turquoise ─────────────────
    // Draw connecting rhombus/kite shapes from star to corners
    g.fillStyle = px(REF_TURQUOISE);
    for (let i = 0; i < pts; i++) {
      const aOuter = (i * Math.PI / 4) - Math.PI / 2;  // outer point direction
      const aMid   = aOuter + Math.PI / 8;              // mid between two outer points
      // Kite polygon: from outer point outward to edge, sweeping to neighbour
      g.beginPath();
      g.moveTo(cx + Math.cos(aOuter) * outerR * 0.92, cy + Math.sin(aOuter) * outerR * 0.92);
      g.lineTo(cx + Math.cos(aOuter) * w * 0.5 * 0.88, cy + Math.sin(aOuter) * w * 0.5 * 0.88);
      g.lineTo(cx + Math.cos(aMid) * w * 0.46, cy + Math.sin(aMid) * w * 0.46);
      g.lineTo(cx + Math.cos(aMid + Math.PI / 8) * w * 0.5 * 0.88, cy + Math.sin(aMid + Math.PI / 8) * w * 0.5 * 0.88);
      g.lineTo(cx + Math.cos(aOuter + Math.PI / 4) * outerR * 0.92, cy + Math.sin(aOuter + Math.PI / 4) * outerR * 0.92);
      g.closePath(); g.fill();
    }

    // ── 2. Strap ribbons from center star to tile edges ───────────────────
    g.strokeStyle = px(REF_WHITE);
    g.lineWidth = strapW;
    g.lineCap = 'square';
    for (let i = 0; i < pts; i++) {
      const aOuter = (i * Math.PI / 4) - Math.PI / 2;
      const startX = cx + Math.cos(aOuter) * outerR * 0.88;
      const startY = cy + Math.sin(aOuter) * outerR * 0.88;
      const endX   = cx + Math.cos(aOuter) * w * 0.505;
      const endY   = cy + Math.sin(aOuter) * w * 0.505;
      g.beginPath();
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
      g.stroke();
    }

    // ── 3. Dark strap-edge outlines for interlaced depth ─────────────────
    g.strokeStyle = 'rgba(10,25,65,0.50)';
    g.lineWidth = Math.max(1, strapHalf * 0.28);
    g.lineCap = 'round';
    for (let i = 0; i < pts; i++) {
      const aOuter = (i * Math.PI / 4) - Math.PI / 2;
      const perpA  = aOuter + Math.PI / 2;
      const startR = outerR * 0.72;
      const endR   = w * 0.505;
      for (const side of [-1, 1]) {
        const offX = Math.cos(perpA) * strapHalf * side;
        const offY = Math.sin(perpA) * strapHalf * side;
        g.beginPath();
        g.moveTo(cx + Math.cos(aOuter) * startR + offX, cy + Math.sin(aOuter) * startR + offY);
        g.lineTo(cx + Math.cos(aOuter) * endR   + offX, cy + Math.sin(aOuter) * endR   + offY);
        g.stroke();
      }
    }

    // ── 4. 8-pointed star at center ───────────────────────────────────────
    star8ctx(g, cx, cy, outerR, px(REF_WHITE));

    // ── 5. Star outline for depth ─────────────────────────────────────────
    g.strokeStyle = 'rgba(10,25,65,0.42)';
    g.lineWidth = Math.max(1, strapW * 0.22);
    g.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = (i * Math.PI / pts) - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.stroke();

    // ── 6. Gold inner star ────────────────────────────────────────────────
    star8ctx(g, cx, cy, w * 0.14, px(REF_GOLD));

    // ── 7. Quarter-stars at each corner for seamless tiling ───────────────
    for (const [kx, ky] of [[0, 0], [w, 0], [0, w], [w, w]] as [number, number][]) {
      star8ctx(g, kx, ky, w * 0.195, px(REF_TURQUOISE));
      // Gold accent at corner star centre
      g.fillStyle = px(REF_GOLD);
      g.beginPath(); g.arc(kx, ky, w * 0.038, 0, Math.PI * 2); g.fill();
    }

    // ── 8. Subtle specular glaze sheen ────────────────────────────────────
    const sheenGrad = g.createLinearGradient(w * 0.2, w * 0.1, w * 0.8, w * 0.6);
    sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
    sheenGrad.addColorStop(0.45, 'rgba(255,255,255,0.07)');
    sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheenGrad;
    g.fillRect(0, 0, w, w);
  }

  const [cv, g] = canvas(S, S, REF_COBALT, draw, false); // pilasters: no 2x
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

/** Blocky pseudo-kufic calligraphy strip on cobalt. Seeded — no Math.random.
 * Richer version: varied stroke weights, serifs, horizontal baseline tabs,
 * dot diacritics, gold frame top+bottom. Reads as inscription at distance. */
function portalDrawKuficBand(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 1,
) {
  ctx.save();
  ctx.fillStyle = px(C_COBALT); ctx.fillRect(x, y, w, h);

  // Gold trim top + bottom
  ctx.fillStyle = px(C_GOLD);
  ctx.fillRect(x, y, w, h * 0.06);
  ctx.fillRect(x, y + h * 0.94, w, h * 0.06);

  // Inner fine gold rule lines (authentic kufic frame has double rules)
  ctx.strokeStyle = px(C_GOLD);
  ctx.lineWidth = Math.max(1, h * 0.018);
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.13); ctx.lineTo(x + w, y + h * 0.13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.87); ctx.lineTo(x + w, y + h * 0.87); ctx.stroke();

  // Baseline (horizontal rule at 82% height — the kufic baseline)
  ctx.fillStyle = px(C_WHITE);
  ctx.fillRect(x + h * 0.2, y + h * 0.82, w - h * 0.4, Math.max(2, h * 0.032));

  // Glyph strokes with varied weights
  const rnd = makeLcg(seed);
  const bw = h * 0.145; // base glyph width
  let gx = x + h * 0.38;
  while (gx < x + w - h * 0.38) {
    const wMult = rnd() > 0.6 ? 1.6 : (rnd() > 0.4 ? 1.0 : 0.7); // varied weight
    const gw = bw * wMult;
    const tall = h * (0.38 + rnd() * 0.38);
    const gy = y + h * 0.82 - tall;

    // Main vertical stroke
    ctx.fillStyle = px(C_WHITE);
    ctx.fillRect(gx, gy, gw, tall);

    // Horizontal tab at top (alif crossbar / lam head)
    if (rnd() > 0.38) {
      const tabW = h * (0.22 + rnd() * 0.22);
      const tabH = h * 0.05;
      ctx.fillRect(gx - tabW * 0.3, gy - tabH, gw + tabW * 0.6, tabH);
    }

    // Horizontal connector shelf (mid-height — creates "step" in kufic)
    if (rnd() > 0.55) {
      const shelfH = h * 0.038;
      const shelfW = h * (0.18 + rnd() * 0.28);
      ctx.fillRect(gx, gy + tall * (0.3 + rnd() * 0.3), shelfW, shelfH);
    }

    // Dot diacritic above tall strokes
    if (rnd() > 0.62 && tall > h * 0.5) {
      const dotR = Math.max(2, h * 0.045);
      ctx.beginPath();
      ctx.arc(gx + gw / 2, gy - dotR * 2.2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Serif foot at baseline
    if (rnd() > 0.35) {
      const sfW = gw * 1.4, sfH = h * 0.032;
      ctx.fillRect(gx - (sfW - gw) / 2, y + h * 0.82, sfW, sfH);
    }

    gx += gw + h * (0.08 + rnd() * 0.18);
  }
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
 * Dark iwan side-wall / vault tile texture.
 * Cobalt-dark field with faint turquoise girih diamond lattice and small gold accents.
 * Low overall brightness so the recess reads as shadowed depth, not a lit surface.
 * Slightly darker than the back-wall iwanTexture to push depth.
 */
export function iwanSideTile(): THREE.CanvasTexture {
  const BASE = 512;

  function draw(g: CanvasRenderingContext2D, S: number, _H: number) {
    // Very dark cobalt field
    g.fillStyle = '#0e2240'; g.fillRect(0, 0, S, S);

    // Faint diagonal diamond grid (turquoise, low alpha so it reads as tilework not solid colour)
    const cellSize = Math.round(S * 0.20); // 5 diamonds per tile
    const lineW = Math.max(1, Math.round(S * 0.006));
    g.strokeStyle = 'rgba(66,200,200,0.30)';
    g.lineWidth = lineW;
    g.lineCap = 'square';

    const diag = Math.sqrt(2) * S;
    const count = Math.ceil(diag / cellSize) + 4;
    for (let i = -count; i < count * 2; i++) {
      const off = i * cellSize;
      g.beginPath(); g.moveTo(off - S, -S); g.lineTo(off + S * 2, S * 2); g.stroke();
      g.beginPath(); g.moveTo(off + S, -S); g.lineTo(off - S, S * 2);     g.stroke();
    }

    // Small gold diamond accent at every other lattice intersection
    const halfCell = cellSize / 2;
    const ms = Math.round(cellSize * 0.10);
    g.fillStyle = 'rgba(217,181,69,0.45)';
    for (let iy = -2; iy < Math.ceil(S / halfCell) + 2; iy++) {
      for (let ix = -2; ix < Math.ceil(S / halfCell) + 2; ix++) {
        if ((ix + iy) % 2 !== 0) continue; // alternate intersections only
        const cx = (ix + iy) * halfCell;
        const cy = (iy - ix) * halfCell;
        if (cx < -cellSize || cx > S + cellSize || cy < -cellSize || cy > S + cellSize) continue;
        g.beginPath();
        g.moveTo(cx, cy - ms); g.lineTo(cx + ms, cy);
        g.lineTo(cx, cy + ms); g.lineTo(cx - ms, cy);
        g.closePath(); g.fill();
      }
    }
  }

  const [cv, g] = canvas(BASE, BASE, 0x0e2240, draw, false); // lower priority — no 2x needed
  draw(g, BASE, BASE);
  return toTexture(cv);
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
