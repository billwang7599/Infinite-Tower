/** Auto lock: the arena captures the mouse by itself as a battle starts, instead of waiting for a click. */
import { clamp, roundTo, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedMouse = SavedSettings["mouse"];

interface MousePrefs {
  autoLock: boolean;
  swingSensitivity: number;
}

const AUTO_LOCK_DEFAULT = true;
export const SWING_SENSITIVITY = { min: 0.5, max: 2, step: 0.05, default: 1 } as const;

export class MouseSettings extends Store<MousePrefs> {
  constructor() {
    super({ autoLock: AUTO_LOCK_DEFAULT, swingSensitivity: SWING_SENSITIVITY.default });
  }

  /** Left out (a save from before it existed), unreadable or out of range: the default. */
  restore(saved: SavedMouse): void {
    const autoLock = saved?.autoLock, sensitivity = saved?.swingSensitivity;
    const sensitivityOk = typeof sensitivity === "number"
      && sensitivity >= SWING_SENSITIVITY.min && sensitivity <= SWING_SENSITIVITY.max;
    this.set({
      autoLock: typeof autoLock === "boolean" ? autoLock : AUTO_LOCK_DEFAULT,
      swingSensitivity: sensitivityOk ? sensitivity : SWING_SENSITIVITY.default,
    });
  }

  toSaved(): NonNullable<SavedMouse> {
    const { autoLock, swingSensitivity } = this.get();
    return {
      ...autoLock === AUTO_LOCK_DEFAULT ? {} : { autoLock },
      ...swingSensitivity === SWING_SENSITIVITY.default ? {} : { swingSensitivity },
    };
  }

  setAutoLock(on: boolean): void {
    this.set({ autoLock: on });
  }

  setSwingSensitivity(value: number): void {
    const snapped = roundTo(Math.round(value / SWING_SENSITIVITY.step) * SWING_SENSITIVITY.step, 2);
    this.set({ swingSensitivity: clamp(snapped, SWING_SENSITIVITY.min, SWING_SENSITIVITY.max) });
  }

  isDefault(): boolean {
    return Object.keys(this.toSaved()).length === 0;
  }
}
