import * as THREE from 'three';

export function addSunsetLights(scene: THREE.Scene) {
  // ── Key Sun: warm low-angle golden-hour — long raking shadows from minarets/pylons
  // Position: west-southwest, low elevation so shadows rake across the plaza
  const sun = new THREE.DirectionalLight(0xffcc88, 2.8);
  sun.position.set(-35, 16, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 36;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.intensity = 0.65; // soft but present — golden-hour shadows
  scene.add(sun);

  // ── Sky fill: slightly cool on top (blue-sky), warm amber ground bounce
  //    Keeps shadows reading cool-warm contrast without going dead grey
  const hemi = new THREE.HemisphereLight(0xd8e8f8, 0xf4c870, 0.72);
  scene.add(hemi);

  // ── Warm bounce / east fill: secondary warm fill from opposite side
  //    Keeps east-facing stone faces alive without going grey
  const east = new THREE.DirectionalLight(0xf8e0b8, 0.40);
  east.position.set(28, 8, -8);
  scene.add(east);

  // ── Warm rim light: catches turquoise domes and gold finials from above-rear
  //    Simulates golden sky bounce lighting the top surfaces of domes
  const rim = new THREE.DirectionalLight(0xffaa44, 0.60);
  rim.position.set(-10, 35, -25); // high rear — back-lights dome tops
  scene.add(rim);

  // ── Atmospheric fog: exponential, very faint warm haze.
  //    Density 0.003 keeps foreground crisp; only geometry beyond ~80 units starts to warm-haze.
  //    Warm cream color prevents the fog from greying out stone.
  scene.fog = new THREE.FogExp2(0xf5e8d0, 0.003);
}
