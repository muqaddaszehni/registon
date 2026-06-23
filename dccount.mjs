import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-angle=metal','--enable-gpu'] });
const p = await b.newPage({ viewport:{width:1440,height:900}, deviceScaleFactor:2 });
await p.goto('http://localhost:5174/?dbg', { waitUntil:'networkidle', timeout:15000 });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const { renderer, scene, camera } = window.__dbg;
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera); // single direct scene render (incl. shadow pass)
  const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
  // count meshes
  let meshes = 0, shadowCasters = 0;
  scene.traverse(o => { if (o.isMesh) { meshes++; if (o.castShadow) shadowCasters++; } });
  return { calls, tris, meshes, shadowCasters };
});
console.log(JSON.stringify(r));
await b.close();
