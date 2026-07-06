import * as THREE from 'three';

export function addSunsetLights(scene: THREE.Scene) {
  // ── Key Sun: bright, near-neutral DAYLIGHT (matching the Wikipedia photos —
  //    clear day, warm-white sun, fairly high so shadows are short and soft).
  const sun = new THREE.DirectionalLight(0xffe7b6, 3.6); // warm low-key sun, raking for form shadows
  sun.position.set(-28, 22, 16); // low raking angle → long form-defining shadows across iwans/minarets
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 38;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 130 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.shadow.intensity = 0.90; // deep cast shadows so relief reads (sky fill no longer lifts them)
  scene.add(sun);

  // ── Sky fill: desaturated sky above + warm-buff ground bounce. Kept low so
  //    concave recesses fall into warm shade instead of flat clay.
  const hemi = new THREE.HemisphereLight(0xd4dde2, 0xf4e2ba, 0.45); // desaturated sky fill + warm buff ground bounce
  scene.add(hemi);

  // ── Near-neutral sky fill on the shade side so it doesn't go muddy (faint).
  const fill = new THREE.DirectionalLight(0xdfe3e4, 0.07);
  fill.position.set(30, 20, -10);
  scene.add(fill);

  // ── Soft neutral bounce on the far/east massing so it stays bright, not grey.
  const east = new THREE.DirectionalLight(0xfaf2e4, 0.10);
  east.position.set(26, 10, -6);
  scene.add(east);

  // ── Gentle high rim to catch the turquoise dome crowns + gold finials.
  const rim = new THREE.DirectionalLight(0xfff4e2, 0.35);
  rim.position.set(-12, 40, -28);
  scene.add(rim);

  // ── Atmospheric fog: linear, pushed well past the ensemble so only the far
  //    background void hazes (the ortho cam sits ~60u out and the ensemble spans
  //    ~45-95u, so a 72-start fogged the whole foreground — washed-out). Start
  //    beyond the back massing; gentle warm-pale falloff into the horizon.
  scene.fog = new THREE.Fog(0xe7e3d8, 120, 215);
}
