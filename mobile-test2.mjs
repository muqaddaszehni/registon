import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const PORT = process.env.PORT || 5173;
const OUT='/tmp/mobile-iter1'; mkdirSync(OUT,{recursive:true});
const iPhone = devices['iPhone 13'];
const b = await chromium.launch();
const c = await b.newContext({ ...iPhone });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);

// PINCH: dispatch 2-finger spreading touch on the canvas
const zBefore = await p.evaluate(()=>window.__game.zoom.target);
await p.evaluate(()=>{
  const el = document.querySelector('canvas');
  const mk = (id,x,y)=> new Touch({ identifier:id, target:el, clientX:x, clientY:y, pageX:x, pageY:y });
  const fire = (type, ts)=> el.dispatchEvent(new TouchEvent(type, { touches:ts, targetTouches:ts, changedTouches:ts, bubbles:true, cancelable:true }));
  fire('touchstart', [mk(1,160,330), mk(2,230,360)]);
  // spread apart over several moves (zoom in)
  for(let i=1;i<=8;i++){ const d=i*10; fire('touchmove', [mk(1,160-d,330-d), mk(2,230+d,360+d)]); }
  fire('touchend', []);
});
await p.waitForTimeout(1000);
const zAfter = await p.evaluate(()=>window.__game.zoom.target);
console.log('PINCH zoom target:', zBefore, '->', zAfter, zAfter<zBefore?'(zoomed in OK)':'(NO CHANGE)');

// CARD: force-open the Registan card and screenshot the overlay
await p.evaluate(()=>window.__cards.show(7));
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/card-tj.png` });
const cardInfo = await p.evaluate(()=>{
  const card=document.querySelector('.card'); const close=document.querySelector('.card .close');
  const cr=card.getBoundingClientRect(); const xr=close?close.getBoundingClientRect():null;
  return { cardW:Math.round(cr.width), cardH:Math.round(cr.height), cardTop:Math.round(cr.top), vpH: innerHeight,
    closeW: xr?Math.round(xr.width):0, closeH: xr?Math.round(xr.height):0, overflow: cr.bottom>innerHeight+1 };
});
console.log('CARD:', JSON.stringify(cardInfo));
// switch to EN card too
await p.evaluate(()=>{ localStorage.setItem('lang','en'); window.__cards.show(7); });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/card-en.png` });
await b.close();
console.log('done',OUT);
