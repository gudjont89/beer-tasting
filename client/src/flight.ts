import { MAX_ALTITUDE, MAX_SPEED, TREE_BASE_RADIUS, TREE_HEIGHT, TREES, terrainHeight, WORLD_HALF_SIZE } from '@bird/shared';
import type { FlightInput } from './input.ts';

const MAX_BANK = 0.9; // rad
const MAX_PITCH = 0.7; // rad
const TURN_RATE = 1.4; // rad/s at full bank
const CRUISE_SPEED = 22;
const MAX_FLIGHT_SPEED = MAX_SPEED * 0.9; // leave headroom under the server's speed check
const GRAVITY_SPEED_GAIN = 25; // speed change per unit of sin(pitch): dive to speed up, climb to slow down
const GROUND_CLEARANCE = 2;
const MIN_SPEED = 8;
const BIRD_RADIUS = 1.5; // body clearance around a tree; wing tips may still clip
const TREE_SCRAPE_DRAG = 8; // 1/s: how fast contact with a tree bleeds speed toward MIN_SPEED

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** Arcade flight: bank to turn, pitch to climb/dive, speed trades against altitude. */
export class FlightModel {
  pose: Pose;
  speed = CRUISE_SPEED;

  constructor(start: Pose) {
    this.pose = { ...start };
  }

  step(input: FlightInput, dt: number) {
    const p = this.pose;
    const smooth = 1 - Math.exp(-4 * dt);
    p.roll += (input.roll * MAX_BANK - p.roll) * smooth;
    p.pitch += (input.pitch * MAX_PITCH - p.pitch) * smooth;
    p.yaw += (p.roll / MAX_BANK) * TURN_RATE * dt;

    const targetSpeed = CRUISE_SPEED - Math.sin(p.pitch) * GRAVITY_SPEED_GAIN;
    this.speed += (Math.min(MAX_FLIGHT_SPEED, Math.max(MIN_SPEED, targetSpeed)) - this.speed) * smooth;

    const cp = Math.cos(p.pitch);
    p.x += Math.sin(p.yaw) * cp * this.speed * dt;
    p.y += Math.sin(p.pitch) * this.speed * dt;
    p.z += Math.cos(p.yaw) * cp * this.speed * dt;

    p.x = Math.min(WORLD_HALF_SIZE, Math.max(-WORLD_HALF_SIZE, p.x));
    p.z = Math.min(WORLD_HALF_SIZE, Math.max(-WORLD_HALF_SIZE, p.z));

    const floor = terrainHeight(p.x, p.z) + GROUND_CLEARANCE;
    if (p.y < floor) {
      p.y = floor;
      p.pitch = Math.max(p.pitch, 0);
    }
    p.y = Math.min(p.y, MAX_ALTITUDE);

    if (this.pushOutOfTrees()) {
      this.speed -= (this.speed - MIN_SPEED) * (1 - Math.exp(-TREE_SCRAPE_DRAG * dt));
    }
  }

  /** Treat each tree as a cone; move the bird to its surface (horizontally) if inside. Returns true on contact. */
  private pushOutOfTrees(): boolean {
    const p = this.pose;
    let hit = false;
    for (const tree of TREES) {
      const height = TREE_HEIGHT * tree.scale;
      const h = p.y - tree.baseY;
      if (h < 0 || h > height) continue;
      const reach = TREE_BASE_RADIUS * tree.scale * (1 - h / height) + BIRD_RADIUS;
      const dx = p.x - tree.x;
      const dz = p.z - tree.z;
      const dist2 = dx * dx + dz * dz;
      if (dist2 >= reach * reach) continue;
      hit = true;
      const dist = Math.sqrt(dist2);
      // Dead centre has no direction; back out the way the bird came from.
      const nx = dist > 1e-6 ? dx / dist : -Math.sin(p.yaw);
      const nz = dist > 1e-6 ? dz / dist : -Math.cos(p.yaw);
      p.x = tree.x + nx * reach;
      p.z = tree.z + nz * reach;
    }
    return hit;
  }
}
