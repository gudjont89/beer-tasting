import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene } from '@babylonjs/core';

export interface BirdVisual {
  root: TransformNode;
  /** Advance wing flapping; `speed` scales the flap rate. */
  animate(timeSec: number, speed: number): void;
  dispose(): void;
}

/** Stable pleasant colour per session id. */
function colorFor(id: string): Color3 {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Color3.FromHSV(h % 360, 0.6, 0.95);
}

export function createBird(scene: Scene, id: string): BirdVisual {
  const root = new TransformNode(`bird-${id}`, scene);
  const mat = new StandardMaterial(`birdMat-${id}`, scene);
  mat.diffuseColor = colorFor(id);
  mat.specularColor = Color3.Black();
  const beakMat = new StandardMaterial(`beakMat-${id}`, scene);
  beakMat.diffuseColor = new Color3(1, 0.7, 0.1);

  const parts: Mesh[] = [];
  const add = (mesh: Mesh, material = mat) => {
    mesh.material = material;
    parts.push(mesh);
    return mesh;
  };

  const body = add(MeshBuilder.CreateSphere('body', { diameter: 1, segments: 8 }, scene));
  body.scaling.set(0.9, 0.8, 1.8);
  body.parent = root;

  const head = add(MeshBuilder.CreateSphere('head', { diameter: 0.6, segments: 8 }, scene));
  head.position.set(0, 0.25, 0.95);
  head.parent = root;

  // Cone points +Y by default; rotate to point along +Z (forward).
  const beak = add(MeshBuilder.CreateCylinder('beak', { height: 0.4, diameterTop: 0, diameterBottom: 0.2, tessellation: 8 }, scene), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.22, 1.35);
  beak.parent = root;

  const tail = add(MeshBuilder.CreateBox('tail', { width: 0.5, height: 0.05, depth: 0.8 }, scene));
  tail.position.set(0, 0.05, -1.1);
  tail.parent = root;

  // Wings hinge at the body, so each sits under a pivot node we can rotate.
  const makeWing = (side: 1 | -1) => {
    const pivot = new TransformNode(`wingPivot${side}`, scene);
    pivot.parent = root;
    pivot.position.set(side * 0.35, 0.1, 0.1);
    const wing = add(MeshBuilder.CreateBox('wing', { width: 2, height: 0.06, depth: 0.9 }, scene));
    wing.position.x = side * 1;
    wing.parent = pivot;
    return pivot;
  };
  const left = makeWing(-1);
  const right = makeWing(1);

  return {
    root,
    animate(timeSec, speed) {
      const flap = Math.sin(timeSec * (6 + speed * 0.15)) * 0.5;
      // Babylon: +rotation.z lifts the +X side.
      right.rotation.z = flap;
      left.rotation.z = -flap;
    },
    dispose() {
      for (const p of parts) p.dispose();
      root.dispose();
      mat.dispose();
      beakMat.dispose();
    },
  };
}
