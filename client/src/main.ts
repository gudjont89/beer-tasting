import { Engine, FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { CLIENT_SEND_RATE_HZ, terrainHeight } from '@bird/shared';
import { createBird, loadBirdModel } from './birdMesh.ts';
import { FlightModel } from './flight.ts';
import { InputController } from './input.ts';
import { Network } from './network.ts';
import { RemoteBirds } from './remoteBirds.ts';
import { buildWorld } from './world.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const startForm = $<HTMLFormElement>('start');
const nameInput = $<HTMLInputElement>('name');
const tiltRow = $('tilt-row');
const tiltBox = $<HTMLInputElement>('tilt');
const statusEl = $('status');
const hud = $('hud');

const input = new InputController();
if (InputController.tiltSupported()) tiltRow.hidden = false;

startForm.addEventListener('submit', (e) => {
  e.preventDefault();
  void start();
});

async function start() {
  const button = startForm.querySelector('button')!;
  button.disabled = true;
  statusEl.textContent = 'Connecting…';

  try {
    // Permission prompt must happen in the click handler's call stack.
    if (tiltBox.checked && !(await input.enableTilt())) {
      statusEl.textContent = 'Tilt permission denied; using keyboard.';
    }

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    buildWorld(scene);

    const camera = new FreeCamera('cam', new Vector3(0, 80, -20), scene);
    camera.minZ = 0.3;
    camera.maxZ = 2000;

    statusEl.textContent = 'Loading model…';
    await loadBirdModel(scene);
    statusEl.textContent = 'Connecting…';

    const remotes = new RemoteBirds(scene);
    const network = new Network();
    const flight = new FlightModel({ x: 0, y: 60, z: 0, yaw: 0, pitch: 0, roll: 0 });
    const localBird = createBird(scene, 'local');

    await network.connect(
      { name: nameInput.value.trim() },
      {
        birdAdded: (id, bird) => {
          if (id === network.sessionId) {
            // Server picks the spawn point.
            Object.assign(flight.pose, { x: bird.x, y: bird.y, z: bird.z });
          } else {
            remotes.add(id, bird);
          }
        },
        birdChanged: (id, bird) => {
          if (id !== network.sessionId) remotes.push(id, bird);
        },
        birdRemoved: (id) => remotes.remove(id),
        correction: ({ x, y, z }) => Object.assign(flight.pose, { x, y, z }),
        disconnected: () => {
          hud.textContent = 'Disconnected. Reload to rejoin.';
        },
      },
    );

    startForm.hidden = true;
    hud.hidden = false;

    const camPos = new Vector3();
    let sendAccumulator = 0;
    let elapsed = 0;
    let cameraInitialised = false;

    engine.runRenderLoop(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
      elapsed += dt;

      flight.step(input.read(dt), dt);
      const p = flight.pose;
      localBird.root.position.set(p.x, p.y, p.z);
      localBird.root.rotation.set(-p.pitch, p.yaw, -p.roll);
      localBird.animate(elapsed, flight.speed);

      // Chase camera: behind and above the bird, eased so turns feel weighty.
      const back = 12;
      const wanted = new Vector3(p.x - Math.sin(p.yaw) * back, p.y + 4, p.z - Math.cos(p.yaw) * back);
      wanted.y = Math.max(wanted.y, terrainHeight(wanted.x, wanted.z) + 2);
      if (!cameraInitialised) {
        camPos.copyFrom(wanted);
        cameraInitialised = true;
      }
      Vector3.LerpToRef(camPos, wanted, 1 - Math.exp(-5 * dt), camPos);
      camera.position.copyFrom(camPos);
      camera.setTarget(new Vector3(p.x, p.y + 1, p.z));

      remotes.update(elapsed);

      sendAccumulator += dt;
      if (sendAccumulator >= 1 / CLIENT_SEND_RATE_HZ) {
        sendAccumulator = 0;
        network.sendPose({ ...p });
      }

      hud.textContent =
        `Players: ${remotes.count + 1}\n` +
        `Alt: ${Math.round(p.y)}  Speed: ${Math.round(flight.speed)}` +
        (input.tiltActive ? '\nTilt steering on' : '');

      scene.render();
    });

    window.addEventListener('resize', () => engine.resize());
    canvas.addEventListener('dblclick', () => input.recalibrate());
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Could not connect: ${err instanceof Error ? err.message : String(err)}`;
    button.disabled = false;
  }
}
