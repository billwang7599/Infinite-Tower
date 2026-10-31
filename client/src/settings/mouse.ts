/** Auto lock: the arena captures the mouse by itself as a battle starts, instead of waiting for a click. */
import { clamp, roundTo, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedMouse = SavedSettings["mouse"];

interface MousePrefs {
  autoLock: boolean;
  flickSensitivity: number;
}

const AUTO_LOCK_DEFAULT = true;
export const FLICK_SENSITIVITY = { min: 0.5, max: 2, step: 0.05, default: 1 } as const;

export class MouseSettings extends Store<MousePrefs> {
  constructor() {
    super({ autoLock: AUTO_LOCK_DEFAULT, flickSensitivity: FLICK_SENSITIVITY.default });
  }

  /** Left out (a save from before it existed), unreadable or out of range: the default. */
  restore(saved: SavedMouse): void {
    const autoLock = saved?.autoLock, sensitivity = saved?.flickSensitivity;
    const sensitivityOk = typeof sensitivity === "number"
      && sensitivity >= FLICK_SENSITIVITY.min && sensitivity <= FLICK_SENSITIVITY.max;
    this.set({
      autoLock: typeof autoLock === "boolean" ? autoLock : AUTO_LOCK_DEFAULT,
      flickSensitivity: sensitivityOk ? sensitivity : FLICK_SENSITIVITY.default,
    });
  }

  toSaved(): NonNullable<SavedMouse> {
    const { autoLock, flickSensitivity } = this.get();
    return {
      ...autoLock === AUTO_LOCK_DEFAULT ? {} : { autoLock },
      ...flickSensitivity === FLICK_SENSITIVITY.default ? {} : { flickSensitivity },
    };
  }

  setAutoLock(on: boolean): void {
    this.set({ autoLock: on });
  }

  setFlickSensitivity(value: number): void {
    const snapped = roundTo(Math.round(value / FLICK_SENSITIVITY.step) * FLICK_SENSITIVITY.step, 2);
    this.set({ flickSensitivity: clamp(snapped, FLICK_SENSITIVITY.min, FLICK_SENSITIVITY.max) });
  }
}
