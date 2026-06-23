import * as THREE from 'three';

// Zehni square-Kufic wordmark (user-supplied brand asset in /public/zehni.jpg)
// recoloured into a Registan tile panel: deep-cobalt field, turquoise glyph,
// white keyline, gold border — the classic banna'i panel look.
const px = (n: number) => '#' + n.toString(16).padStart(6, '0');
const COBALT = 0x1c3f78;   // deep blue field (matches the inset tile panels)
const TURQ   = 0x53d4d4;   // turquoise glyph tiles
const WHITE  = 0xfff6e3;
const GOLD   = 0xd9b545;

/** Framed Zehni tile panel. Returns immediately; the glyph fills in once the
 *  image loads (texture.needsUpdate is flipped then). */
export function zehniPanelTexture(): THREE.CanvasTexture {
  const W = 768, H = 880;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  // ── Field + frame ──────────────────────────────────────────────────
  g.fillStyle = px(COBALT); g.fillRect(0, 0, W, H);
  const b = Math.round(W * 0.055);
  g.fillStyle = px(GOLD);               // gold border band
  g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b);
  g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H);
  g.fillStyle = px(WHITE);              // thin white inner rule (banna'i keyline)
  g.fillRect(b, b, W - 2 * b, Math.max(2, W * 0.006));
  g.fillRect(b, H - b - Math.max(2, W * 0.006), W - 2 * b, Math.max(2, W * 0.006));
  g.fillRect(b, b, Math.max(2, W * 0.006), H - 2 * b);
  g.fillRect(W - b - Math.max(2, W * 0.006), b, Math.max(2, W * 0.006), H - 2 * b);

  // ── Recolour the supplied logo (dark glyph → turquoise tiles, white → field) ─
  const img = new Image();
  img.onload = () => {
    const tmp = document.createElement('canvas');
    tmp.width = img.width; tmp.height = img.height;
    const t = tmp.getContext('2d')!;
    t.drawImage(img, 0, 0);
    const id = t.getImageData(0, 0, img.width, img.height);
    const d = id.data;
    const tr = (TURQ >> 16) & 255, tg = (TURQ >> 8) & 255, tb = TURQ & 255;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      if (lum < 130) { d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = 255; } // glyph
      else { d[i + 3] = 0; }                                                       // field shows
    }
    t.putImageData(id, 0, 0);
    // Centre the glyph inside the frame, preserving its aspect.
    const pad = Math.round(W * 0.13);
    const aw = W - pad * 2, ah = H - pad * 2;
    const ar = img.width / img.height;
    let dw = aw, dh = aw / ar;
    if (dh > ah) { dh = ah; dw = ah * ar; }
    g.drawImage(tmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
    tex.needsUpdate = true;
  };
  img.src = '/zehni.jpg';

  return tex;
}
