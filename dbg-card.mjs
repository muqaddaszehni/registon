import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4000);
const r = await p.evaluate(()=>{
  window.__cards.show(5);
  const ui=document.getElementById('ui');
  const zo=[...ui.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Zoom out');
  const cs=getComputedStyle(zo);
  return { uiClass: ui.className, portrait: matchMedia('(orientation: portrait)').matches,
    zoPE: cs.pointerEvents, zoOpacity: cs.opacity, vp:[innerWidth,innerHeight],
    isDirectChild: zo.parentElement.id };
});
console.log(JSON.stringify(r));
await b.close();
