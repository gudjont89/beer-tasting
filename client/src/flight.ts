import { MAX_ALTITUDE, MAX_SPEED, terrainHeight, WORLD_HALF_SIZE } from '@bird/shared';
import type { FlightInput } from './input.ts';

const MAX_BANK = 0.9; // rad
const MAX_PITCH = 0.7; // rad
const TURN_RATE = 1.4; // rad/s at full bank
const CRUISE_SPEED = 22;
const MAX_FLIGHT_SPEED = MAX_SPEED * 0.9; // leave headroom under the server's speed check
const GRAVITY_SPEED_GAIN = 25; // speed change per unit of sin(pitch): dive to speed up, climb to slow down
const GROUND_CLEARANCE = 2;

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
    this.speed += (Math.min(MAX_FLIGHT_SPEED, Math.max(8, targetSpeed)) - this.speed) * smooth;

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
  }
}
