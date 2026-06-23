import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('EXC:'+e.message));
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
const st = () => p.evaluate(()=>({ z:+window.__game.zoom.target.toFixed(3), hx:+window.__game.hero.worldPos.x.toFixed(2), hz:+window.__game.hero.worldPos.z.toFixed(2), music: window.__audioCtx?window.__audioCtx.state:'none' }));

// 1) ZOOM buttons
await p.locator('[aria-label="Zoom in"]').tap(); await p.waitForTimeout(700);
const zin = (await st()).z;
await p.locator('[aria-label="Zoom out"]').tap(); await p.waitForTimeout(700);
const zout = (await st()).z;

// 2) PINCH (dispatch 2-finger spread)
await p.evaluate(()=>{ const el=document.querySelector('canvas');
  const mk=(id,x,y)=>new Touch({identifier:id,target:el,clientX:x,clientY:y,pageX:x,pageY:y});
  const fire=(t,ts)=>el.dispatchEvent(new TouchEvent(t,{touches:ts,targetTouches:ts,changedTouches:ts,bubbles:true,cancelable:true}));
  fire('touchstart',[mk(1,160,330),mk(2,230,360)]);
  for(let i=1;i<=8;i++){const d=i*9;fire('touchmove',[mk(1,160-d,330-d),mk(2,230+d,360+d)]);}
  fire('touchend',[]); });
await p.waitForTimeout(700);
const zpinch = (await st()).z;

// reset zoom to 1
await p.evaluate(()=>window.__game.zoom.setTarget(1)); await p.waitForTimeout(700);

// 3) DOUBLE-TAP zoom (two quick taps) — should zoom, NOT walk
const pre = await st();
await p.locator('canvas').tap({ position:{x:200,y:330} });
await p.waitForTimeout(90);
await p.locator('canvas').tap({ position:{x:200,y:330} });
await p.waitForTimeout(900);
const dbl = await st();

// 4) SINGLE TAP-TO-MOVE (after double-tap window) — should walk
await p.evaluate(()=>{ window.__game.zoom.setTarget(1); window.__game.hero.walkTo(window.__game.hero.tile); });
await p.waitForTimeout(400);
const beforeMove = await st();
await p.locator('canvas').tap({ position:{x:160,y:380} });
await p.waitForTimeout(2200);
const afterMove = await st();

// 5) CARD open + CLOSE button (stop hero first so onArrive cannot hide it)
await p.evaluate(()=>{ const h=window.__game.hero; h.walkTo(h.tile); });
await p.waitForTimeout(600);
await p.evaluate(()=>window.__cards.show(5));
await p.waitForTimeout(800);
const cardOpen = await p.evaluate(()=>!!document.querySelector('.card.open'));
await p.locator('.card .close').tap();
await p.waitForTimeout(600);
const cardClosed = await p.evaluate(()=>!document.querySelector('.card.open'));

console.log('zoomIn<1:', zin<1, '('+zin+')');
console.log('zoomOut->1:', zout, '| pinchZoom<1:', zpinch<1, '('+zpinch+')');
console.log('doubleTap zoom<0.95:', dbl.z<0.95, '('+dbl.z+')  heroMoved:', (Math.abs(dbl.hx-pre.hx)+Math.abs(dbl.hz-pre.hz)).toFixed(2));
console.log('tapMove walked:', (Math.abs(afterMove.hx-beforeMove.hx)+Math.abs(afterMove.hz-beforeMove.hz))>0.3, JSON.stringify(beforeMove),'->',JSON.stringify(afterMove));
console.log('cardOpen:', cardOpen, '| cardClosedAfterX:', cardClosed);
console.log('music:', (await st()).music, '| errs:', JSON.stringify(errs));
await b.close();
