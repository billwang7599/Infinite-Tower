/** Auto lock: the arena captures the mouse by itself as a battle starts, instead of waiting for a click. */
import type { SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedMouse = SavedSettings["mouse"];

interface MousePrefs {
  autoLock: boolean;
}

const AUTO_LOCK_DEFAULT = true;

export class MouseSettings extends Store<MousePrefs> {
  constructor() {
    super({ autoLock: AUTO_LOCK_DEFAULT });
  }

  /** Left out (a save from before it existed) or unreadable: the default. */
  restore(saved: SavedMouse): void {
    const value = saved?.autoLock;
    this.set({ autoLock: typeof value === "boolean" ? value : AUTO_LOCK_DEFAULT });
  }

  toSaved(): NonNullable<SavedMouse> {
    return this.isDefault() ? {} : { autoLock: this.get().autoLock };
  }

  setAutoLock(on: boolean): void {
    this.set({ autoLock: on });
  }

  isDefault(): boolean {
    return this.get().autoLock === AUTO_LOCK_DEFAULT;
  }
}
