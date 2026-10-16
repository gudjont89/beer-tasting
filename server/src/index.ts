import config, { listen } from '@colyseus/tools';
import { defineRoom } from '@colyseus/core';
import { ROOM_NAME } from '@bird/shared';
import { GameRoom } from './GameRoom.ts';

const port = Number(process.env.PORT ?? 2567);

await listen(
  config({
    rooms: { [ROOM_NAME]: defineRoom(GameRoom) },
  }),
  port,
);
