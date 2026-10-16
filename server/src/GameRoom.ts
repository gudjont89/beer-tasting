import { Room, type Client } from '@colyseus/core';
import {
  Bird,
  GameState,
  MAX_ALTITUDE,
  MAX_PLAYERS_PER_ROOM,
  MAX_SPEED,
  MessageType,
  MIN_ALTITUDE,
  SERVER_PATCH_RATE_MS,
  SPEED_TOLERANCE,
  WORLD_HALF_SIZE,
  type CorrectionMessage,
  type JoinOptions,
  type PoseMessage,
} from '@bird/shared';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isFinitePose = (p: PoseMessage) =>
  [p.x, p.y, p.z, p.yaw, p.pitch, p.roll].every(Number.isFinite);

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS_PER_ROOM;

  private lastPoseAt = new Map<string, number>();

  onCreate() {
    this.setState(new GameState());
    this.setPatchRate(SERVER_PATCH_RATE_MS);
    this.onMessage<PoseMessage>(MessageType.Pose, (client, pose) => this.handlePose(client, pose));
  }

  onJoin(client: Client, options: JoinOptions) {
    const bird = new Bird();
    bird.name = (options.name ?? '').slice(0, 16) || `bird-${client.sessionId.slice(0, 4)}`;
    bird.y = 60;
    bird.x = (Math.random() - 0.5) * 100;
    bird.z = (Math.random() - 0.5) * 100;
    this.state.birds.set(client.sessionId, bird);
    this.lastPoseAt.set(client.sessionId, Date.now());
  }

  onLeave(client: Client) {
    this.state.birds.delete(client.sessionId);
    this.lastPoseAt.delete(client.sessionId);
  }

  /**
   * Movement is client-authoritative within limits: we accept the pose if it is
   * physically reachable, otherwise we pin the bird to the furthest allowed point
   * and tell the client to snap back. Anything competitive (hits, scoring) must be
   * decided here, not trusted from the client.
   */
  private handlePose(client: Client, pose: PoseMessage) {
    const bird = this.state.birds.get(client.sessionId);
    if (!bird || !isFinitePose(pose)) return;

    const now = Date.now();
    const dt = Math.min((now - (this.lastPoseAt.get(client.sessionId) ?? now)) / 1000, 1);
    this.lastPoseAt.set(client.sessionId, now);

    let { x, y, z } = pose;
    x = clamp(x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    y = clamp(y, MIN_ALTITUDE, MAX_ALTITUDE);
    z = clamp(z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);

    const dx = x - bird.x;
    const dy = y - bird.y;
    const dz = z - bird.z;
    const dist = Math.hypot(dx, dy, dz);
    const maxDist = MAX_SPEED * SPEED_TOLERANCE * Math.max(dt, 1 / 60);

    if (dist > maxDist) {
      const k = maxDist / dist;
      bird.x += dx * k;
      bird.y += dy * k;
      bird.z += dz * k;
      const correction: CorrectionMessage = { x: bird.x, y: bird.y, z: bird.z };
      client.send(MessageType.Correction, correction);
    } else {
      bird.x = x;
      bird.y = y;
      bird.z = z;
    }
    bird.yaw = pose.yaw;
    bird.pitch = pose.pitch;
    bird.roll = pose.roll;
  }
}
