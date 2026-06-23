import * as THREE from 'three';

export function makeSky(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const g = cv.getContext('2d')!;

  // ── Clear-day sky to match the Wikipedia photos: a soft daytime blue zenith
  //    easing to a pale, faintly-warm haze at the horizon (the dawn-panorama
  //    look). Values are pre-compensated for ACES desaturation downstream.
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0,    '#6f9fd2'); // daytime blue zenith
  grad.addColorStop(0.22, '#86b0db'); // sky blue
  grad.addColorStop(0.44, '#a6c8e6'); // lighter blue
  grad.addColorStop(0.64, '#c8dcec'); // pale blue
  grad.addColorStop(0.82, '#e0ebf0'); // very pale haze
  grad.addColorStop(0.93, '#edf0ec'); // pale warm-white horizon
  grad.addColorStop(1,    '#f3ede0'); // faint warm dust at the horizon base
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  // ── Soft horizon haze: a gentle pale brightening at the horizon (atmospheric
  //    depth on a clear day), no warm sunset disc.
  g.save();
  const glow = g.createRadialGradient(256, 560, 30, 256, 560, 340);
  glow.addColorStop(0,    'rgba(245,245,238,0.10)');
  glow.addColorStop(0.5,  'rgba(235,238,238,0.04)');
  glow.addColorStop(1,    'rgba(230,235,238,0.0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = glow;
  g.fillRect(0, 320, 512, 192);
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
