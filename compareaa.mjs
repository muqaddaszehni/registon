import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const PORT = process.env.PORT || 5173;
const OUT='/tmp/aacmp'; mkdirSync(OUT,{recursive:true});
const POSE = { n:'A1', tx:17.5, ty:12, tz:6.6, az:0.55, el:0.42, zoom:3.2 };
const configs = [['ref-msaa4-smaa','msaa4&smaa'],['msaa0-smaa','msaa0&smaa'],['msaa0-fxaa','msaa0']];
const b = await chromium.launch({ args:['--use-angle=metal','--enable-gpu'] });
for (const [name,q] of configs){
  const p = await b.newPage({ viewport:{width:1400,height:1000}, deviceScaleFactor:2 });
  await p.goto(`http://localhost:${PORT}/?dbg&${q}`,{waitUntil:'networkidle',timeout:15000});
  await p.waitForTimeout(4500);
  await p.evaluate(pose=>window.inspect(pose), POSE);
  await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/${name}.png`});
  console.log('shot',name);
  await p.close();
}
await b.close(); console.log('done',OUT);
