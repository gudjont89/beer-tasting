# Birds

Multiplayer 3D bird flying game for the browser. Babylon.js client, Colyseus server, TypeScript throughout.

```
shared/   schema, constants, message types, terrain function (imported by both sides)
server/   Colyseus room: validates poses, owns anything competitive
client/   Babylon.js scene, flight model, input (keyboard + phone tilt), networking
```

## Develop

```
npm install
npm run dev        # server on :2567, client on :5173 (proxied to the server at /server)
npm run typecheck
npm run build      # client only -> client/dist
```

Phone tilt needs a secure context. On desktop `localhost` is fine. To test from a phone over the LAN:

```
HTTPS=1 npm run dev
```

then open `https://<your-ip>:5173` and accept the self-signed certificate warning. Double-tap the canvas to recalibrate the neutral tilt.

## Netcode

- Clients own their movement and send a pose at 20 Hz.
- The server rejects poses that exceed `MAX_SPEED` (with tolerance), clamps to world bounds, and sends a `correction` to snap the client back.
- State patches go out every 50 ms; remote birds are rendered 100 ms in the past and interpolated.
- Anything competitive (hits, scoring) must be decided on the server, not trusted from the client.
