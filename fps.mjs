import { chromium } from 'playwright';

const PORT = process.env.PORT || 5173;
const URL = `http://localhost:${PORT}/`;

const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('EXC:', e.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000); // intro + LOD settle

async function sample(seconds, label) {
  const fps = [], cpu = [], frame = [];
  const n = seconds * 4;
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(250);
    const p = await page.evaluate(() => window.__perf);
    if (p) { fps.push(p.fps); cpu.push(p.cpuMs); frame.push(p.frameMs); }
  }
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const max = a => Math.max(...a);
  console.log(`${label}: fps≈${avg(fps).toFixed(1)} (min ${(1000/max(frame)).toFixed(1)})  cpuMs≈${avg(cpu).toFixed(2)}  worstFrameMs≈${max(frame).toFixed(1)}`);
  return { fps: avg(fps), cpu: avg(cpu) };
}

// Idle
await sample(4, 'IDLE   ');

// Rotation load: keep the camera easing for the whole window
const rotate = page.locator('[aria-label="Rotate view"]');
const spin = (async () => { for (let i = 0; i < 8; i++) { await rotate.click().catch(()=>{}); await page.waitForTimeout(600); } })();
await sample(4, 'ROTATE ');
await spin;

// Walk load: tap around the plaza so the hero walks (drives shadow updates)
const cv = page.locator('canvas');
const walk = (async () => {
  const pts = [[720, 560], [600, 520], [840, 600], [700, 640]];
  for (const [x, y] of pts) { await cv.click({ position: { x, y } }).catch(()=>{}); await page.waitForTimeout(900); }
})();
await sample(4, 'WALK   ');
await walk;

// Draw-call / triangle counts from the perf probe
const info = await page.evaluate(() => ({ calls: window.__perf.calls, tris: window.__perf.tris }));
console.log('RENDER.INFO:', JSON.stringify(info));
await browser.close();
