import { chromium, devices } from 'playwright';
import { mkdirSync } from 'fs';
const PORT = process.env.PORT || 5173;
const OUT='/tmp/mobile-final'; mkdirSync(OUT,{recursive:true});
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4500);
await p.screenshot({ path:`${OUT}/01-landing.png` });
// open a card (English) and screenshot — buttons should hide, close reachable
await p.evaluate(()=>{ localStorage.setItem('lang','en'); window.__cards.show(7); });
await p.waitForTimeout(900);
await p.screenshot({ path:`${OUT}/02-card-en.png` });
// Tajik card (longer text → scroll)
await p.evaluate(()=>{ window.__cards.hide(); });
await p.waitForTimeout(300);
await p.evaluate(()=>{ window.__cards.show(1); document.querySelector('.card').dataset.lang='tj'; });
await p.waitForTimeout(400);
await p.evaluate(()=>window.__cards.show(1));
await p.waitForTimeout(700);
await p.screenshot({ path:`${OUT}/03-card.png` });
// zoom in via pinch then screenshot
await p.evaluate(()=>{ window.__cards.hide(); window.__game.zoom.setTarget(0.4); });
await p.waitForTimeout(900);
await p.screenshot({ path:`${OUT}/04-zoomed.png` });
await b.close(); console.log('done');
