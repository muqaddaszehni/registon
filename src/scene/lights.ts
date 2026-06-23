import * as THREE from 'three';

export function addSunsetLights(scene: THREE.Scene) {
  // ── Key Sun: warm low-angle golden-hour — long raking shadows from minarets/pylons.
  //    Strong key vs. soft cool fill creates the golden-hour light/shadow SPLIT:
  //    lit faces glow amber, shadowed faces fall cool-violet (matching the sky).
  //    Position: west-southwest, low elevation so shadows rake long across the plaza.
  const sun = new THREE.DirectionalLight(0xffd49a, 3.4);
  sun.position.set(-28, 28, 14); // ~3pm afternoon: higher elevation (~42°), shorter shadows
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); // crisper, softer-filtered contact shadows
  const s = 38;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3; // PCF soft penumbra — golden-hour soft edges
  sun.shadow.intensity = 0.9; // deep, readable shadows (cool fill lifts them back)
  scene.add(sun);

  // ── Sky fill: cool periwinkle from above (open sky), warm amber ground bounce.
  //    Lowered intensity so the sun reads as a clear key. The COOL top tint is what
  //    pushes shadow-side stone toward violet so it reads cool-against-warm.
  const hemi = new THREE.HemisphereLight(0xaec4ec, 0xf2c074, 0.50);
  scene.add(hemi);

  // ── Cool sky fill (anti-key): faint blue-violet wash on the shadowed faces so
  //    they don't go black — fills from the sky side opposite the sun.
  const fill = new THREE.DirectionalLight(0xbcc8ec, 0.22);
  fill.position.set(30, 20, -10);
  scene.add(fill);

  // ── Warm rim / back-light: low warm ambient lift on east-facing stone so the
  //    far massing stays alive and warm rather than going grey-cool.
  const east = new THREE.DirectionalLight(0xffcf96, 0.30);
  east.position.set(26, 7, -6);
  scene.add(east);

  // ── Warm dome-crown rim: high rear amber light catching turquoise dome tops
  //    and gold finials, simulating warm sky bounce on the crowns.
  const rim = new THREE.DirectionalLight(0xff9c44, 0.85);
  rim.position.set(-12, 38, -28); // high rear — back-lights dome tops + finials
  scene.add(rim);

  // ── Atmospheric fog: exponential, very faint WARM haze.
  //    Density 0.0035 keeps foreground crisp; distant massing warm-recedes.
  //    Warm peach-cream color so haze reads as golden air, never greys the stone.
  scene.fog = new THREE.FogExp2(0xf6dfbe, 0.0016);
}
