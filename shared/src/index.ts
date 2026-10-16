import { schema, t, type SchemaType } from '@colyseus/schema';

export const ROOM_NAME = 'game';
export const MAX_PLAYERS_PER_ROOM = 16;

/** How often clients send their pose, and how often the server pushes state patches. */
export const CLIENT_SEND_RATE_HZ = 20;
export const SERVER_PATCH_RATE_MS = 50;
/** Remote birds are rendered this far in the past so there are always two samples to interpolate between. */
export const INTERPOLATION_DELAY_MS = 100;

export const WORLD_HALF_SIZE = 500;
export const MIN_ALTITUDE = 1;
export const MAX_ALTITUDE = 300;
/** Units per second. Clients cruise below this; the server rejects anything much faster. */
export const MAX_SPEED = 40;
/** Slack on the server speed check to absorb jitter and clock skew between pose packets. */
export const SPEED_TOLERANCE = 1.5;

export const Bird = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    yaw: t.float32(),
    pitch: t.float32(),
    roll: t.float32(),
  },
  'Bird',
);
export type Bird = SchemaType<typeof Bird>;

export const GameState = schema(
  {
    birds: t.map(Bird),
  },
  'GameState',
);
export type GameState = SchemaType<typeof GameState>;

export interface JoinOptions {
  name?: string;
}

/** Client → server, unreliable-ish high frequency. */
export interface PoseMessage {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** Server → one client: your pose was rejected, snap back here. */
export interface CorrectionMessage {
  x: number;
  y: number;
  z: number;
}

export const MessageType = {
  Pose: 'pose',
  Correction: 'correction',
} as const;

/** Rolling terrain, 0..~20 units high. Pure function so client and (later) server agree on it. */
export function terrainHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.011) * Math.cos(z * 0.013) * 8 +
    Math.sin(x * 0.037 + z * 0.021) * 3 +
    Math.cos(z * 0.029 - x * 0.017) * 2;
  return h + 13;
}
