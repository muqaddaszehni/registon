import * as THREE from 'three';

export function addSunsetLights(scene: THREE.Scene) {
  // ── Key Sun: bright, near-neutral DAYLIGHT (matching the Wikipedia photos —
  //    clear day, warm-white sun, fairly high so shadows are short and soft).
  const sun = new THREE.DirectionalLight(0xffeec8, 3.4); // warm-white daylight (keeps buff stone warm)
  sun.position.set(-22, 40, 18); // high midday-ish sun → short soft shadows
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 38;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.62; // softer, daylit shadows (strong sky fill lifts them)
  scene.add(sun);

  // ── Sky fill: bright pale-blue sky above + warm-buff ground bounce. Strong so
  //    shadowed buff stone stays light and warm, as in the daytime photos.
  const hemi = new THREE.HemisphereLight(0xc6dcf0, 0xf4e2ba, 0.82); // warm buff ground bounce
  scene.add(hemi);

  // ── Cool sky fill on the shade side so it doesn't go muddy (faint, neutral).
  const fill = new THREE.DirectionalLight(0xd4e2f2, 0.14);
  fill.position.set(30, 20, -10);
  scene.add(fill);

  // ── Soft neutral bounce on the far/east massing so it stays bright, not grey.
  const east = new THREE.DirectionalLight(0xfaf2e4, 0.22);
  east.position.set(26, 10, -6);
  scene.add(east);

  // ── Gentle high rim to catch the turquoise dome crowns + gold finials.
  const rim = new THREE.DirectionalLight(0xfff4e2, 0.35);
  rim.position.set(-12, 40, -28);
  scene.add(rim);

  // ── Atmospheric fog: very faint, near-neutral pale haze (clear-day depth),
  //    matching the photos' pale horizon — never greys/warms the stone much.
  scene.fog = new THREE.FogExp2(0xe6ebec, 0.0013);
}
