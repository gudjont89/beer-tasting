import type { Scene } from '@babylonjs/core';
import { INTERPOLATION_DELAY_MS, type Bird } from '@bird/shared';
import { createBird, type BirdVisual } from './birdMesh.ts';
import type { Pose } from './flight.ts';

interface Sample {
  at: number; // performance.now() when the snapshot arrived
  pose: Pose;
}

interface Remote {
  visual: BirdVisual;
  samples: Sample[];
  name: string;
}

const MAX_SAMPLES = 20;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
};

const toPose = (b: Bird): Pose => ({ x: b.x, y: b.y, z: b.z, yaw: b.yaw, pitch: b.pitch, roll: b.roll });

/** Renders other players ~100 ms in the past, interpolating between received snapshots. */
export class RemoteBirds {
  private birds = new Map<string, Remote>();

  constructor(private scene: Scene) {}

  get count() {
    return this.birds.size;
  }

  add(id: string, bird: Bird) {
    const remote: Remote = { visual: createBird(this.scene, id), samples: [], name: bird.name };
    this.birds.set(id, remote);
    this.push(id, bird);
  }

  push(id: string, bird: Bird) {
    const remote = this.birds.get(id);
    if (!remote) return;
    remote.samples.push({ at: performance.now(), pose: toPose(bird) });
    if (remote.samples.length > MAX_SAMPLES) remote.samples.shift();
  }

  remove(id: string) {
    this.birds.get(id)?.visual.dispose();
    this.birds.delete(id);
  }

  update(timeSec: number) {
    const renderAt = performance.now() - INTERPOLATION_DELAY_MS;
    for (const { visual, samples } of this.birds.values()) {
      const pose = sampleAt(samples, renderAt);
      if (!pose) continue;
      visual.root.position.set(pose.x, pose.y, pose.z);
      visual.root.rotation.set(-pose.pitch, pose.yaw, -pose.roll);
      visual.animate(timeSec, 22);
    }
  }
}

function sampleAt(samples: Sample[], at: number): Pose | null {
  const first = samples[0];
  if (!first) return null;
  if (at <= first.at) return first.pose;
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i]!;
    if (at <= b.at) {
      const a = samples[i - 1]!;
      const t = (at - a.at) / (b.at - a.at || 1);
      return {
        x: lerp(a.pose.x, b.pose.x, t),
        y: lerp(a.pose.y, b.pose.y, t),
        z: lerp(a.pose.z, b.pose.z, t),
        yaw: lerpAngle(a.pose.yaw, b.pose.yaw, t),
        pitch: lerp(a.pose.pitch, b.pose.pitch, t),
        roll: lerp(a.pose.roll, b.pose.roll, t),
      };
    }
  }
  // Ran out of samples (packet gap): hold the last known pose rather than extrapolating.
  return samples[samples.length - 1]!.pose;
}
