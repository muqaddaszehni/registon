#!/usr/bin/env node
// Optimize the Blender-exported Registan GLB for the web with @gltf-transform.
//
//   node scripts/optimize-glb.mjs [input.glb] [output.glb]
//
// Defaults: public/models/registan.glb -> public/models/registan.opt.glb
//
// Stages: dedup -> prune -> flatten -> join -> weld -> quantize -> meshopt
// (EXT_meshopt_compression) -> optional textureCompress to WebP (only if
// `sharp` is installed; skipped gracefully otherwise).
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, flatten, join, weld, quantize, meshopt, textureCompress,
} from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const input = resolve(process.argv[2] ?? 'public/models/registan.glb');
const output = resolve(process.argv[3] ?? 'public/models/registan.opt.glb');

if (!existsSync(input)) {
  console.error(
    `optimize-glb: input not found: ${input}\n` +
    `  Build it first with \`npm run model:build\` (tools/blender/build_registan.py),\n` +
    `  or pass a path: node scripts/optimize-glb.mjs <input.glb> [output.glb]`,
  );
  process.exit(1);
}

function stats(doc) {
  const root = doc.getRoot();
  const meshes = root.listMeshes();
  return {
    meshes: meshes.length,
    primitives: meshes.reduce((n, m) => n + m.listPrimitives().length, 0),
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    nodes: root.listNodes().length,
  };
}

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes.toLocaleString()} B)`;

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

const beforeBytes = statSync(input).size;
const doc = await io.read(input);
const before = stats(doc);

const transforms = [
  dedup(),
  prune(),
  flatten(),
  join(),
  weld(),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
];

// Texture compression to WebP needs the optional native `sharp` module.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('optimize-glb: `sharp` not installed - skipping WebP texture compression.');
}
if (sharp) {
  transforms.push(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85 }));
}

await doc.transform(...transforms);
await io.write(output, doc);

const afterBytes = statSync(output).size;
const after = stats(doc);

console.log(`\noptimize-glb: ${input}\n           -> ${output}\n`);
console.log(`  size       ${fmtMB(beforeBytes)}  ->  ${fmtMB(afterBytes)}  (${((1 - afterBytes / beforeBytes) * 100).toFixed(1)}% smaller)`);
for (const key of ['meshes', 'primitives', 'materials', 'textures', 'nodes']) {
  console.log(`  ${key.padEnd(10)} ${String(before[key]).padStart(6)}  ->  ${String(after[key]).padStart(6)}`);
}
