const LINE_PX = 40;
const PAGE_PX = 800;
const PINCH_GAIN = 4;
const NOTCH_PX = 50;
const FIRST_STEP_PX = 3;
const NEXT_STEP_PX = 120;
const GESTURE_GAP_MS = 150;
const MIN_STEP_GAP_MS = 60;

export const wheelPx = (e: Pick<WheelEvent, "deltaY" | "deltaMode" | "ctrlKey">) =>
  e.deltaY * (e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? PAGE_PX : 1) * (e.ctrlKey ? PINCH_GAIN : 1);

// A mouse notch (one big delta) is one step. A trackpad's stream of small deltas is one gesture: it steps once at
// its start, then only every NEXT_STEP_PX more, so a small flick doesn't jump several levels.
export class WheelZoom {
  private sum = 0;
  private stepped = false;
  private lastEventMs = -Infinity;
  private lastStepMs = -Infinity;

  steps(deltaPx: number, nowMs: number): -1 | 0 | 1 {
    if (nowMs - this.lastEventMs > GESTURE_GAP_MS) {
      this.sum = 0;
      this.stepped = false;
    }
    this.lastEventMs = nowMs;
    this.sum += deltaPx;
    const need = Math.abs(deltaPx) >= NOTCH_PX ? 0 : this.stepped ? NEXT_STEP_PX : FIRST_STEP_PX;
    if (Math.abs(this.sum) < need || nowMs - this.lastStepMs < MIN_STEP_GAP_MS) return 0;
    const step = this.sum < 0 ? 1 : -1;
    this.sum = 0;
    this.stepped = true;
    this.lastStepMs = nowMs;
    return step;
  }
}
