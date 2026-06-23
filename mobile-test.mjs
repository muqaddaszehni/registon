import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const iPhone = devices['iPhone 13'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iPhone });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('EXC:'+e.message));
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
const g = () => p.evaluate(()=>({ z: window.__game.zoom.target, hx:+window.__game.hero.worldPos.x.toFixed(2), hz:+window.__game.hero.worldPos.z.toFixed(2), music: window.__audioCtx?window.__audioCtx.state:'none' }));
const before = await g();

// ZOOM IN button (proper element tap)
await p.locator('[aria-label="Zoom in"]').tap();
await p.waitForTimeout(900);
const afterZin = await g();

// ZOOM OUT button
await p.locator('[aria-label="Zoom out"]').tap();
await p.waitForTimeout(900);
const afterZout = await g();

// TAP-TO-MOVE: tap the canvas at a plaza location
await p.locator('canvas').tap({ position: { x: 195, y: 360 } });
await p.waitForTimeout(2500);
const afterMove = await g();

// DOUBLE-TAP zoom on canvas
await p.locator('canvas').tap({ position: { x: 195, y: 330 } });
await p.waitForTimeout(120);
await p.locator('canvas').tap({ position: { x: 195, y: 330 } });
await p.waitForTimeout(1200);
const afterDbl = await g();

console.log('before  ', JSON.stringify(before));
console.log('zoomIn  ', JSON.stringify(afterZin));
console.log('zoomOut ', JSON.stringify(afterZout));
console.log('tapMove ', JSON.stringify(afterMove));
console.log('dblTap  ', JSON.stringify(afterDbl));
console.log('errs', JSON.stringify(errs));
await b.close();
