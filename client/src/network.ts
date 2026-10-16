import { Callbacks, ColyseusSDK, type Room } from '@colyseus/sdk';
import {
  Bird,
  GameState,
  MessageType,
  ROOM_NAME,
  type CorrectionMessage,
  type JoinOptions,
  type PoseMessage,
} from '@bird/shared';

export interface NetworkEvents {
  birdAdded(id: string, bird: Bird): void;
  birdChanged(id: string, bird: Bird): void;
  birdRemoved(id: string): void;
  correction(pos: CorrectionMessage): void;
  disconnected(): void;
}

export class Network {
  private room!: Room<unknown, GameState>;

  get sessionId() {
    return this.room.sessionId;
  }

  async connect(options: JoinOptions, events: NetworkEvents) {
    const client = new ColyseusSDK({
      hostname: location.hostname,
      port: location.port ? Number(location.port) : undefined,
      secure: location.protocol === 'https:',
      pathname: '/server',
    });
    this.room = await client.joinOrCreate<GameState>(ROOM_NAME, options, GameState);

    const callbacks = Callbacks.get(this.room);
    callbacks.onAdd('birds', (bird, id) => {
      events.birdAdded(id, bird);
      callbacks.onChange(bird, () => events.birdChanged(id, bird));
    });
    callbacks.onRemove('birds', (_bird, id) => events.birdRemoved(id));

    this.room.onMessage(MessageType.Correction, events.correction);
    this.room.onLeave(() => events.disconnected());
  }

  sendPose(pose: PoseMessage) {
    this.room.send(MessageType.Pose, pose);
  }
}
