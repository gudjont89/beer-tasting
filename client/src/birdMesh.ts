import { LoadAssetContainerAsync, TransformNode, type AssetContainer, type Scene } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import seagullUrl from './assets/seagull.glb?url';

export interface BirdVisual {
  root: TransformNode;
  /** Idle motion for a gliding bird; `speed` is currently unused (the model has no flap). */
  animate(timeSec: number, speed: number): void;
  dispose(): void;
}

// The model is ~85 units across; the game world expects a bird roughly 4 units wide.
const MODEL_SCALE = 0.05;
// Rotation about Y that makes the model's beak point along +Z (the game's forward axis).
const MODEL_YAW = Math.PI / 2;

const containers = new WeakMap<Scene, AssetContainer>();

/** Load the seagull once per scene. Must finish before `createBird` is called. */
export async function loadBirdModel(scene: Scene): Promise<void> {
  if (containers.has(scene)) return;
  containers.set(scene, await LoadAssetContainerAsync(seagullUrl, scene, { pluginExtension: '.glb' }));
}

export function createBird(scene: Scene, id: string): BirdVisual {
  const container = containers.get(scene);
  if (!container) throw new Error('createBird called before loadBirdModel');

  const root = new TransformNode(`bird-${id}`, scene);
  const model = new TransformNode(`birdModel-${id}`, scene);
  model.parent = root;
  model.scaling.setAll(MODEL_SCALE);
  model.rotation.y = MODEL_YAW;

  // Instances share geometry and the (single) material with the container.
  const instance = container.instantiateModelsToScene((name) => `${name}-${id}`, false);
  for (const node of instance.rootNodes) node.parent = model;

  // Per-bird phase so a flock doesn't wobble in unison.
  let phase = 0;
  for (const ch of id) phase = (phase * 31 + ch.charCodeAt(0)) % 628;
  phase /= 100;

  return {
    root,
    animate(timeSec) {
      model.rotation.z = Math.sin(timeSec * 1.3 + phase) * 0.04;
      model.position.y = Math.sin(timeSec * 0.9 + phase) * 0.08;
    },
    dispose() {
      instance.dispose();
      model.dispose();
      root.dispose();
    },
  };
}
