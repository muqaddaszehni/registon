import * as THREE from 'three';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const g = cv.getContext('2d')!;

  // ── Multi-stop gradient: soft violet zenith → cool periwinkle mid-sky
  //    → warm peach → amber horizon. Smooth, finely-stepped so no banding shows.
  // Values are pre-compensated for ACES desaturation through EffectComposer.
  // ACES compresses warm channels, so source peach/amber values are boosted.
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,    '#80709e'); // soft violet zenith (not too dark — golden hour, sky still lit)
  grad.addColorStop(0.18, '#9788b2'); // muted violet
  grad.addColorStop(0.34, '#b49fbe'); // periwinkle-mauve
  grad.addColorStop(0.48, '#cdb1b2'); // dusty mauve→warm transition (neutral blend point)
  grad.addColorStop(0.62, '#e8c49e'); // warm peach
  grad.addColorStop(0.74, '#ffd2a0'); // bright peach (sun-glow band, ACES-compensated)
  grad.addColorStop(0.85, '#ffc488'); // amber
  grad.addColorStop(0.94, '#ffb474'); // deeper amber
  grad.addColorStop(1,    '#ffa866'); // rich amber at horizon base
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  // ── Concentrated horizon sun-glow: soft warm radial bloom low-left (sun side),
  //    sitting on the amber band so the warm low sun reads without a hard disc.
  g.save();
  const glow = g.createRadialGradient(160, 400, 6, 160, 400, 200);
  glow.addColorStop(0,   'rgba(255,238,200,0.34)'); // warm core (soft, not blown)
  glow.addColorStop(0.4, 'rgba(255,216,152,0.14)');
  glow.addColorStop(1,   'rgba(255,202,142,0.0)');  // fades out
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = glow;
  g.fillRect(0, 280, 512, 232);
  g.restore();

  // ── Faint high cirrus wisps — painted with deterministic seed positions
  //    Very low opacity, light streaks suggesting high altitude ice cloud
  g.save();
  g.globalAlpha = 0.045;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.2;
  g.lineCap = 'round';

  // Seeded wisp positions (no Math.random — fixed geometry)
  const wisps = [
    // [x1, y1, cpx, cpy, x2, y2, width]
    [60,  38, 160, 30, 280,  42, 1.0],
    [200, 28, 290, 20, 420,  35, 0.8],
    [80,  55, 170, 48, 310,  60, 0.6],
    [310, 18, 390, 12, 490,  25, 0.9],
    [30,  70, 130, 62, 240,  72, 0.5],
    [350, 45, 430, 38, 500,  50, 0.7],
    [140, 15, 230,  8, 370,  18, 0.6],
    [20,  90, 100, 82, 200,  95, 0.4],
    [420, 25, 480, 18, 510,  30, 0.5],
    [250, 65, 340, 56, 460,  70, 0.6],
  ] as const;

  for (const [x1, y1, cpx, cpy, x2, y2, lw] of wisps) {
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(cpx, cpy, x2, y2);
    g.stroke();
  }
  g.restore();

  // ── Distant bird specks — tiny V-shapes at high altitude, very subtle
  g.save();
  g.globalAlpha = 0.12;
  g.strokeStyle = '#c8b8d8'; // slightly cool-purple so they read against warm horizon
  g.lineWidth = 0.9;
  g.lineCap = 'round';

  // Fixed seed positions for birds (deterministic)
  const birds = [
    // [cx, cy, size] — wing spread as small V
    [380, 48, 4],
    [395, 42, 3],
    [365, 52, 3.5],
    [408, 46, 2.5],
    [355, 44, 3],
    [110, 35, 3.5],
    [125, 30, 3],
    [98,  40, 2.5],
    [460, 60, 3],
    [472, 55, 2.5],
    [450, 65, 2],
    [240, 22, 3],
    [252, 18, 2.5],
  ] as const;

  for (const [cx, cy, size] of birds) {
    g.beginPath();
    // Left wing
    g.moveTo(cx - size, cy + size * 0.4);
    g.quadraticCurveTo(cx - size * 0.5, cy - size * 0.2, cx, cy);
    // Right wing
    g.quadraticCurveTo(cx + size * 0.5, cy - size * 0.2, cx + size, cy + size * 0.4);
    g.stroke();
  }
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
