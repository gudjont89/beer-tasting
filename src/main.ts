import './style.css';

const SCALE_MAX = 5;

// Glass: horizontal, closed end on the left, open end on the right.
const GLASS = { x: 20, y: 10, width: 260, height: 80 };
// Bottle: vertical, neck at the top.
const BOTTLE = { top: 10, bottom: 290 };

// Tilt (degrees, phone rotated counter-clockwise) at which pouring starts / is fastest.
const POUR_START_DEG = 25;
const POUR_FULL_DEG = 90;
const FULL_POUR_SECONDS = 4;

const marks = Array.from({ length: SCALE_MAX + 1 }, (_, i) => {
  const x = GLASS.x + (i / SCALE_MAX) * GLASS.width;
  return `
    <line x1="${x}" y1="${GLASS.y + GLASS.height}" x2="${x}" y2="${GLASS.y + GLASS.height + 8}" />
    <text x="${x}" y="${GLASS.y + GLASS.height + 24}">${i}</text>`;
}).join('');

requireElement('#app').innerHTML = `
  <section class="start" id="start">
    <h1>Beer Tasting</h1>
    <p>Tilt your phone on its side to pour the bottle into the glass.</p>
    <button id="start-button" type="button">Start pouring</button>
  </section>

  <section class="scene" id="scene" hidden>
    <svg class="glass" viewBox="0 0 300 120" aria-label="Glass">
      <defs>
        <clipPath id="glass-clip">
          <rect x="${GLASS.x}" y="${GLASS.y}" width="${GLASS.width}" height="${GLASS.height}" rx="14" />
        </clipPath>
      </defs>
      <g clip-path="url(#glass-clip)">
        <rect id="glass-liquid" class="liquid" x="${GLASS.x}" y="${GLASS.y}" width="0" height="${GLASS.height}" />
      </g>
      <path class="outline"
        d="M ${GLASS.x + GLASS.width} ${GLASS.y} H ${GLASS.x + 14} Q ${GLASS.x} ${GLASS.y} ${GLASS.x} ${GLASS.y + 14}
           V ${GLASS.y + GLASS.height - 14} Q ${GLASS.x} ${GLASS.y + GLASS.height} ${GLASS.x + 14} ${GLASS.y + GLASS.height}
           H ${GLASS.x + GLASS.width}" />
      <g class="marks">${marks}</g>
    </svg>

    <div class="score"><span id="score">0.0</span><small>/ ${SCALE_MAX}</small></div>

    <svg class="bottle" viewBox="0 0 100 300" aria-label="Bottle">
      <defs>
        <clipPath id="bottle-clip">
          <path id="bottle-shape" d="M 38 10 H 62 V 80 C 62 100 85 110 85 140 V 270 Q 85 290 65 290 H 35 Q 15 290 15 270 V 140 C 15 110 38 100 38 80 Z" />
        </clipPath>
      </defs>
      <g clip-path="url(#bottle-clip)">
        <rect id="bottle-liquid" class="liquid" x="0" y="${BOTTLE.top}" width="100" height="${BOTTLE.bottom - BOTTLE.top}" />
      </g>
      <path class="outline" d="M 38 10 H 62 V 80 C 62 100 85 110 85 140 V 270 Q 85 290 65 290 H 35 Q 15 290 15 270 V 140 C 15 110 38 100 38 80 Z" />
    </svg>
  </section>
`;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const startScreen = requireElement<HTMLElement>('#start');
const scene = requireElement<HTMLElement>('#scene');
const glassLiquid = requireElement<SVGRectElement>('#glass-liquid');
const bottleLiquid = requireElement<SVGRectElement>('#bottle-liquid');
const scoreLabel = requireElement<HTMLElement>('#score');

let glassLevel = 0; // 0..1, the bottle holds the remaining 1 - glassLevel
let tiltDeg = 0;

function render() {
  glassLiquid.setAttribute('width', String(glassLevel * GLASS.width));

  const bottleHeight = (1 - glassLevel) * (BOTTLE.bottom - BOTTLE.top);
  bottleLiquid.setAttribute('y', String(BOTTLE.bottom - bottleHeight));
  bottleLiquid.setAttribute('height', String(bottleHeight));

  scoreLabel.textContent = (glassLevel * SCALE_MAX).toFixed(1);
}

// Pour rate in [-1, 1]: positive tilts pour into the glass, the opposite tilt pours back.
function pourRate(deg: number): number {
  const magnitude = Math.abs(deg);
  if (magnitude < POUR_START_DEG) return 0;
  const strength = Math.min(1, (magnitude - POUR_START_DEG) / (POUR_FULL_DEG - POUR_START_DEG));
  return Math.sign(deg) * strength;
}

let lastFrame = performance.now();
function tick(now: number) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  glassLevel += (pourRate(tiltDeg) * dt) / FULL_POUR_SECONDS;
  glassLevel = Math.min(1, Math.max(0, glassLevel));

  render();
  requestAnimationFrame(tick);
}

// Rotation of the phone within the screen plane. Gravity is read in device axes, so with the
// phone upright y is ~+9.8; turning it counter-clockwise (top edge to the left) moves it to +x.
function onDeviceMotion(event: DeviceMotionEvent) {
  const g = event.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null) return;
  const deg = (Math.atan2(g.x, g.y) * 180) / Math.PI;
  tiltDeg += (deg - tiltDeg) * 0.25; // low-pass to calm sensor jitter
}

async function start() {
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation.lock('portrait');
  } catch {
    // Fullscreen or orientation lock refused; the pour still works if the page stays portrait.
  }

  window.addEventListener('devicemotion', onDeviceMotion);
  startScreen.hidden = true;
  scene.hidden = false;
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

requireElement('#start-button').addEventListener('click', start);
render();
