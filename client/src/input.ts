export interface FlightInput {
  /** -1 (dive) .. 1 (climb) */
  pitch: number;
  /** -1 (bank left) .. 1 (bank right) */
  roll: number;
}

const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));
const approach = (cur: number, target: number, step: number) =>
  cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);

/** Degrees of phone tilt from the calibrated neutral that count as full deflection. */
const TILT_FULL_DEFLECTION_DEG = 30;

export class InputController {
  private keys = new Set<string>();
  private kbPitch = 0;
  private kbRoll = 0;

  private tiltEnabled = false;
  private neutralBeta: number | null = null;
  private tiltPitch = 0;
  private tiltRoll = 0;

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  static tiltSupported(): boolean {
    return typeof DeviceOrientationEvent !== 'undefined' && 'ontouchstart' in window;
  }

  /** Must be called from a user gesture: iOS gates sensor access behind a permission prompt. */
  async enableTilt(): Promise<boolean> {
    const needsPermission = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (needsPermission.requestPermission) {
      if ((await needsPermission.requestPermission()) !== 'granted') return false;
    }
    window.addEventListener('deviceorientation', this.onOrientation);
    this.tiltEnabled = true;
    return true;
  }

  get tiltActive() {
    return this.tiltEnabled;
  }

  /** Treat the current hold angle as level flight. */
  recalibrate() {
    this.neutralBeta = null;
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    this.neutralBeta ??= e.beta;
    // Portrait only for now: gamma is left/right lean, beta is forward/back lean.
    this.tiltRoll = clamp1(e.gamma / TILT_FULL_DEFLECTION_DEG);
    this.tiltPitch = clamp1(-(e.beta - this.neutralBeta) / TILT_FULL_DEFLECTION_DEG);
  };

  read(dt: number): FlightInput {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0;
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0;
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0;

    // Ramp keyboard input so taps don't snap the bird.
    this.kbPitch = approach(this.kbPitch, up - down, dt * 3);
    this.kbRoll = approach(this.kbRoll, right - left, dt * 3);

    return {
      pitch: clamp1(this.kbPitch + this.tiltPitch),
      roll: clamp1(this.kbRoll + this.tiltRoll),
    };
  }
}
