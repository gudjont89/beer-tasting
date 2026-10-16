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
import { TREE_BASE_RADIUS, TREE_HEIGHT, TREES, terrainHeight, WORLD_HALF_SIZE } from '@bird/shared';

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

  const tree = MeshBuilder.CreateCylinder('tree', { height: TREE_HEIGHT, diameterTop: 0, diameterBottom: TREE_BASE_RADIUS * 2, tessellation: 8 }, scene);
  const treeMat = new StandardMaterial('treeMat', scene);
  treeMat.diffuseColor = new Color3(0.12, 0.35, 0.16);
  treeMat.specularColor = Color3.Black();
  tree.material = treeMat;

  const matrices = new Float32Array(TREES.length * 16);
  TREES.forEach(({ x, z, baseY, scale }, i) => {
    Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.Identity(),
      new Vector3(x, baseY + (TREE_HEIGHT / 2) * scale, z),
    ).copyToArray(matrices, i * 16);
  });
  tree.thinInstanceSetBuffer('matrix', matrices, 16, true);
}
