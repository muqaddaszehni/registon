import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4000);
const tap = (x,y)=>p.evaluate(({x,y})=>{
  const el=document.querySelector('canvas');
  const o={clientX:x,clientY:y,isPrimary:true,bubbles:true,cancelable:true,pointerId:1,pointerType:'touch'};
  el.dispatchEvent(new PointerEvent('pointerdown',o));
  el.dispatchEvent(new PointerEvent('pointerup',o));
},{x,y});
const z=()=>p.evaluate(()=>+window.__game.zoom.target.toFixed(3));
const h=()=>p.evaluate(()=>({x:+window.__game.hero.worldPos.x.toFixed(2),z:+window.__game.hero.worldPos.z.toFixed(2)}));
// DOUBLE-TAP (two taps ~120ms apart)
const z0=await z(); const h0=await h();
await tap(200,330); await p.waitForTimeout(120); await tap(200,330);
await p.waitForTimeout(900);
console.log('double-tap: zoom', z0, '->', await z(), '(zoomed in:', (await z())<0.95, ') heroDelta', JSON.stringify(await h()));
// reset
await p.evaluate(()=>{ window.__game.zoom.setTarget(1); const hr=window.__game.hero; hr.stop(); });
await p.waitForTimeout(600);
// SINGLE TAP (one tap, then idle)
const hb=await h(); await tap(150,400); await p.waitForTimeout(1600);
const ha=await h();
console.log('single-tap walked:', (Math.abs(ha.x-hb.x)+Math.abs(ha.z-hb.z))>0.3, JSON.stringify(hb),'->',JSON.stringify(ha));
await b.close();
