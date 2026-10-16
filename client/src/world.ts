import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  VertexBuffer,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { terrainHeight, WORLD_HALF_SIZE } from '@bird/shared';

const TREE_COUNT = 400;

/** Small deterministic PRNG so every client builds the identical forest. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(scene: Scene) {
  scene.clearColor = new Color4(0.53, 0.72, 0.91, 1);
  scene.fogMode = 2; // exponential
  scene.fogDensity = 0.0025;
  scene.fogColor = new Color3(0.53, 0.72, 0.91);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.3), scene);
  sun.intensity = 0.8;

  const size = WORLD_HALF_SIZE * 2;
  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size, subdivisions: 200, updatable: true }, scene);
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] = terrainHeight(positions[i]!, positions[i + 2]!);
  }
  ground.updateVerticesData(VertexBuffer.PositionKind, positions);
  ground.createNormals(true);
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new Color3(0.32, 0.55, 0.25);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;

  const tree = MeshBuilder.CreateCylinder('tree', { height: 14, diameterTop: 0, diameterBottom: 7, tessellation: 8 }, scene);
  const treeMat = new StandardMaterial('treeMat', scene);
  treeMat.diffuseColor = new Color3(0.12, 0.35, 0.16);
  treeMat.specularColor = Color3.Black();
  tree.material = treeMat;

  const rand = mulberry32(1337);
  const matrices = new Float32Array(TREE_COUNT * 16);
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (rand() * 2 - 1) * (WORLD_HALF_SIZE - 10);
    const z = (rand() * 2 - 1) * (WORLD_HALF_SIZE - 10);
    const scale = 0.7 + rand() * 0.9;
    Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.Identity(),
      new Vector3(x, terrainHeight(x, z) + 7 * scale, z),
    ).copyToArray(matrices, i * 16);
  }
  tree.thinInstanceSetBuffer('matrix', matrices, 16, true);
}
