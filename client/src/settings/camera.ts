/**
 * Camera settings (saved on the server with the rest of the player's settings, settings.ts). For now just the
 * sensitivity: one multiplier on how fast the arena camera turns and tilts, from the mouse / trackpad and from
 * the turn / tilt keys alike. The battle camera reads `settings.camera.get()` every tick, so a change applies at
 * once, mid-fight too.
 */
import { clamp, roundTo, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedCamera = SavedSettings["camera"];

interface CameraPrefs {
  sensitivity: number;
}

export const SENSITIVITY = { min: 0.25, max: 3, step: 0.05, default: 1 } as const;

export class CameraSettings extends Store<CameraPrefs> {
  constructor() {
    super({ sensitivity: SENSITIVITY.default });
  }

  /** Anything unreadable or out of range (an older format, say) falls back to the default. */
  restore(saved: SavedCamera): void {
    const value = saved?.sensitivity;
    const ok = typeof value === "number" && value >= SENSITIVITY.min && value <= SENSITIVITY.max;
    this.set({ sensitivity: ok ? value : SENSITIVITY.default });
  }

  /** Nothing when it's the default. */
  toSaved(): NonNullable<SavedCamera> {
    return this.isDefault() ? {} : { sensitivity: this.get().sensitivity };
  }

  setSensitivity(value: number): void {
    // Snapped to the slider's step, so 1.1 doesn't come out as 1.1000000000000003.
    const snapped = roundTo(Math.round(value / SENSITIVITY.step) * SENSITIVITY.step, 2);
    this.set({ sensitivity: clamp(snapped, SENSITIVITY.min, SENSITIVITY.max) });
  }

  reset(): void {
    this.setSensitivity(SENSITIVITY.default);
  }

  isDefault(): boolean {
    return this.get().sensitivity === SENSITIVITY.default;
  }
}
