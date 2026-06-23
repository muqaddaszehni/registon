import { chromium } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs=[]; p.on('pageerror', e=>errs.push('EXC:'+e.message));
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
const fb = p.locator('[aria-label="Frontal view"]');
console.log('before: frontalBtn visible =', await fb.isVisible(), '| turns =', await p.evaluate(()=>window.__game.orbit.turns));
const rot = p.locator('[aria-label="Rotate view"]');
for (let i=0;i<4;i++){ await rot.click(); await p.waitForTimeout(700); }
console.log('after 4 rotations: turns =', await p.evaluate(()=>window.__game.orbit.turns), '| frontalBtn visible =', await fb.isVisible());
// click the secret button
await fb.click(); await p.waitForTimeout(1600);
const st = await p.evaluate(()=>({ frontal: window.__game.orbit.isFrontal, elev: +(window.__game.orbit.state.elev).toFixed(3), az: +(window.__game.orbit.state.azimuth).toFixed(3) }));
console.log('after secret click:', JSON.stringify(st));
await p.screenshot({ path:'/tmp/secret-frontal.png' });
// toggle off
await fb.click(); await p.waitForTimeout(1600);
console.log('after toggle off: frontal =', await p.evaluate(()=>window.__game.orbit.isFrontal));
console.log('errs', JSON.stringify(errs));
await b.close();
