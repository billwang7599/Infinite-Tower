/**
 * Camera settings, saved in this browser. For now just the sensitivity: one multiplier on how fast the arena
 * camera turns and tilts, from the mouse / trackpad and from the turn / tilt keys alike. The battle camera reads
 * `settings.camera.get()` every tick, so a change applies at once, mid-fight too.
 */
import { clamp, roundTo } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

export interface CameraPrefs {
  sensitivity: number;
}

export const SENSITIVITY = { min: 0.25, max: 3, step: 0.05, default: 1 } as const;
const STORAGE_KEY = "infinite-tower:camera";

export class CameraSettings extends Store<CameraPrefs> {
  constructor() {
    super({ sensitivity: load() });
  }

  setSensitivity(value: number): void {
    // Snapped to the slider's step, so 1.1 doesn't come out as 1.1000000000000003.
    const snapped = roundTo(Math.round(value / SENSITIVITY.step) * SENSITIVITY.step, 2);
    this.set({ sensitivity: clamp(snapped, SENSITIVITY.min, SENSITIVITY.max) });
    save(this.get().sensitivity);
  }

  reset(): void {
    this.setSensitivity(SENSITIVITY.default);
  }

  isDefault(): boolean {
    return this.get().sensitivity === SENSITIVITY.default;
  }
}

/** Anything unreadable or out of range (hand-edited, an older format) falls back to the default. */
function load(): number {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    const value = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>).sensitivity : undefined;
    if (typeof value === "number" && value >= SENSITIVITY.min && value <= SENSITIVITY.max) return value;
  } catch {
    // No storage (private mode, sandboxed frame) or bad JSON.
  }
  return SENSITIVITY.default;
}

function save(sensitivity: number): void {
  try {
    if (sensitivity === SENSITIVITY.default) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ sensitivity }));
  } catch {
    // Not saved; the change still applies until the page closes.
  }
}
