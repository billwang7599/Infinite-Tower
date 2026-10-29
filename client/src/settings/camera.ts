/** The arena camera's sensitivity (one multiplier, for the mouse and keys alike) and the overworld camera's turns. */
import { clamp, OVERWORLD_CAMERA_ANGLES, roundTo, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedCamera = SavedSettings["camera"];

interface CameraPrefs {
  sensitivity: number;
  overworldTurns: number;
}

export const SENSITIVITY = { min: 0.25, max: 3, step: 0.05, default: 1 } as const;

export class CameraSettings extends Store<CameraPrefs> {
  constructor() {
    super({ sensitivity: SENSITIVITY.default, overworldTurns: 0 });
  }

  /** Anything unreadable or out of range falls back to the default. */
  restore(saved: SavedCamera): void {
    const value = saved?.sensitivity, turns = saved?.overworldTurns;
    const ok = typeof value === "number" && value >= SENSITIVITY.min && value <= SENSITIVITY.max;
    const turnsOk = Number.isInteger(turns) && turns! >= 0 && turns! < OVERWORLD_CAMERA_ANGLES;
    this.set({ sensitivity: ok ? value : SENSITIVITY.default, overworldTurns: turnsOk ? turns! : 0 });
  }

  toSaved(): NonNullable<SavedCamera> {
    const { sensitivity, overworldTurns } = this.get();
    return {
      ...(this.sensitivityIsDefault() ? {} : { sensitivity }), ...(overworldTurns === 0 ? {} : { overworldTurns }),
    };
  }

  setSensitivity(value: number): void {
    // Snapped to the slider's step, so 1.1 doesn't come out as 1.1000000000000003.
    const snapped = roundTo(Math.round(value / SENSITIVITY.step) * SENSITIVITY.step, 2);
    this.set({ sensitivity: clamp(snapped, SENSITIVITY.min, SENSITIVITY.max) });
  }

  turnOverworld(by: 1 | -1): void {
    this.set({ overworldTurns: (this.get().overworldTurns + by + OVERWORLD_CAMERA_ANGLES) % OVERWORLD_CAMERA_ANGLES });
  }

  reset(): void {
    this.setSensitivity(SENSITIVITY.default);
  }

  sensitivityIsDefault(): boolean {
    return this.get().sensitivity === SENSITIVITY.default;
  }

  isDefault(): boolean {
    return this.sensitivityIsDefault() && this.get().overworldTurns === 0;
  }
}
