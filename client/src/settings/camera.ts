/** The arena camera's sensitivity (one multiplier, for the mouse and keys alike) and the overworld camera's turns. */
import { OVERWORLD_CAMERA_ANGLES, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";
import { savedOnSlider, snapToSlider } from "./slider.js";

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
    const turns = saved?.overworldTurns;
    const turnsOk = Number.isFinite(turns) && turns! >= 0 && turns! < OVERWORLD_CAMERA_ANGLES;
    this.set({
      sensitivity: savedOnSlider(SENSITIVITY, saved?.sensitivity, SENSITIVITY.default),
      overworldTurns: turnsOk ? turns! : 0,
    });
  }

  toSaved(): NonNullable<SavedCamera> {
    const { sensitivity, overworldTurns } = this.get();
    return {
      ...(this.sensitivityIsDefault() ? {} : { sensitivity }), ...(overworldTurns === 0 ? {} : { overworldTurns }),
    };
  }

  setSensitivity(value: number): void {
    this.set({ sensitivity: snapToSlider(SENSITIVITY, value) });
  }

  /** In quarter turns, any part of one. */
  turnOverworld(by: number): void {
    const turns = (this.get().overworldTurns + by) % OVERWORLD_CAMERA_ANGLES;
    this.set({ overworldTurns: (turns + OVERWORLD_CAMERA_ANGLES) % OVERWORLD_CAMERA_ANGLES });
  }

  override reset(): void {
    this.setSensitivity(SENSITIVITY.default);
  }

  sensitivityIsDefault(): boolean {
    return this.get().sensitivity === SENSITIVITY.default;
  }
}
