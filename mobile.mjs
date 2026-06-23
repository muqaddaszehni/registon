import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const PORT = process.env.PORT || 5173;
const OUT = process.argv[2] || '/tmp/mobile';
mkdirSync(OUT, { recursive: true });
const iPhone = devices['iPhone 13'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iPhone });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('EXC:', e.message));
p.on('console', m => { if (m.type()==='error') console.log('ERR:', m.text()); });
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
await p.screenshot({ path: `${OUT}/01-landing.png` });
console.log('vp:', JSON.stringify(p.viewportSize()));
// list interactive button rects + sizes
const btns = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, [aria-label]').forEach(el => {
    const r = el.getBoundingClientRect();
    out.push({ label: el.getAttribute('aria-label')||el.textContent?.slice(0,12), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) });
  });
  return out;
});
console.log('BUTTONS:', JSON.stringify(btns, null, 0));
// tap center plaza to move + open a card (tap a hotspot area)
await p.touchscreen.tap(195, 420);
await p.waitForTimeout(3500);
await p.screenshot({ path: `${OUT}/02-after-tap.png` });
// try to open a card by tapping where a hotspot dot likely is (center)
await p.touchscreen.tap(195, 400);
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/03-card.png` });
await b.close();
console.log('done', OUT);
