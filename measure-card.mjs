import { chromium, devices } from 'playwright';
const PORT = process.env.PORT || 5173;
const b = await chromium.launch();
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(4000);
const m = await p.evaluate(()=>{
  localStorage.setItem('lang','en'); window.__cards.show(7);
  const card=document.querySelector('.card'); const frame=document.querySelector('.card .frame'); const pp=document.querySelector('.card p');
  const cs=getComputedStyle(card);
  return { cardClient:card.clientHeight, cardScroll:card.scrollHeight, cardRectH:Math.round(card.getBoundingClientRect().height),
    frameScroll:frame.scrollHeight, pScroll:pp.scrollHeight, pClient:pp.clientHeight, pText:pp.textContent.length,
    cardPosition:cs.position, cardBottom:cs.bottom, cardTop:cs.top, cardHeight:cs.height, vpH:innerHeight, overflowStyle:cs.overflow };
});
console.log(JSON.stringify(m,null,0));
await b.close();
