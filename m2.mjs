import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4000);
const m = await p.evaluate(()=>{
  window.__cards.show(7);
  const card=document.querySelector('.card'), frame=document.querySelector('.card .frame'), pp=document.querySelector('.card p');
  const cr=card.getBoundingClientRect(), fr=frame.getBoundingClientRect(), pr=pp.getBoundingClientRect();
  return { lang: card.dataset.lang, pText: pp.textContent,
    card:{top:Math.round(cr.top),bottom:Math.round(cr.bottom),h:Math.round(cr.height)},
    frame:{top:Math.round(fr.top),bottom:Math.round(fr.bottom),h:Math.round(fr.height),scrollH:frame.scrollHeight,clientH:frame.clientH||frame.clientHeight},
    p:{top:Math.round(pr.top),bottom:Math.round(pr.bottom)},
    pBelowCard: pr.bottom > cr.bottom, frameScrolls: frame.scrollHeight>frame.clientHeight+1, vpH:innerHeight };
});
console.log(JSON.stringify(m,null,0));
await b.close();
