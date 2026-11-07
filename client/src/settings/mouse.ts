/** Auto lock: the game captures the mouse as a fight starts or a screen over it closes, not waiting for a click. */
import { FLICK_SENSITIVITY, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";
import { savedOnSlider, snapToSlider } from "./slider.js";

type SavedMouse = SavedSettings["mouse"];

interface MousePrefs {
  autoLock: boolean;
  flickSensitivity: number;
}

const AUTO_LOCK_DEFAULT = true;

export class MouseSettings extends Store<MousePrefs> {
  constructor() {
    super({ autoLock: AUTO_LOCK_DEFAULT, flickSensitivity: FLICK_SENSITIVITY.default });
  }

  /** Left out (a save from before it existed), unreadable or out of range: the default. */
  restore(saved: SavedMouse): void {
    const autoLock = saved?.autoLock;
    this.set({
      autoLock: typeof autoLock === "boolean" ? autoLock : AUTO_LOCK_DEFAULT,
      flickSensitivity: savedOnSlider(FLICK_SENSITIVITY, saved?.flickSensitivity, FLICK_SENSITIVITY.default),
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
    this.set({ flickSensitivity: snapToSlider(FLICK_SENSITIVITY, value) });
  }
}
