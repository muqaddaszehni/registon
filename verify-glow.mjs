import { chromium } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
p.on('pageerror', e => console.log('EXC:', e.message));
await p.goto(`http://localhost:${PORT}/?dbg`, { waitUntil: 'networkidle', timeout: 15000 });
await p.waitForTimeout(4500);

// Locate the turquoise additive glow mesh + its screen position.
const loc = await p.evaluate(() => {
  const { scene, camera, renderer } = window.__dbg;
  let glow = null;
  scene.traverse(o => {
    if (o.isMesh && o.material && o.material.isMeshBasicMaterial &&
        o.material.blending === 2 /* AdditiveBlending */ && o.renderOrder === -1) glow = o;
  });
  if (!glow) return { err: 'no glow mesh' };
  const v = glow.position.clone().project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
});
console.log('glow screen pos:', JSON.stringify(loc));
if (loc.err) { await b.close(); process.exit(1); }

async function opacityRange(ms) {
  let lo = 1, hi = 0;
  const n = Math.round(ms / 100);
  for (let i = 0; i < n; i++) {
    await p.waitForTimeout(100);
    const op = await p.evaluate(() => {
      let g = null;
      window.__dbg.scene.traverse(o => {
        if (o.isMesh && o.material && o.material.isMeshBasicMaterial &&
            o.material.blending === 2 && o.renderOrder === -1) g = o;
      });
      return g ? g.material.opacity : -1;
    });
    lo = Math.min(lo, op); hi = Math.max(hi, op);
  }
  return { lo: +lo.toFixed(3), hi: +hi.toFixed(3), amp: +(hi - lo).toFixed(3) };
}

console.log('BEFORE walk (expect pulsing, amp>0.1):', JSON.stringify(await opacityRange(2000)));
// Walk the hero onto the Registan tile (click where the glow is).
await p.mouse.click(loc.x, loc.y);
await p.waitForTimeout(5000); // let the hero walk there + glow fade
console.log('AFTER walk (expect ~0, amp~0):', JSON.stringify(await opacityRange(2000)));
await b.close();
