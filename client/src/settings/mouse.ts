/**
 * Mouse settings (saved on the server with the rest of the player's settings, settings.ts). For now just auto
 * lock: when it's on, the arena captures the mouse by itself as a battle starts (core/mouse.ts), instead of
 * waiting for a click. game.ts reads it at that moment, so a change applies from the next time.
 */
import type { SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedMouse = SavedSettings["mouse"];

interface MousePrefs {
  autoLock: boolean;
}

export const AUTO_LOCK_DEFAULT = true;

export class MouseSettings extends Store<MousePrefs> {
  constructor() {
    super({ autoLock: AUTO_LOCK_DEFAULT });
  }

  /** Left out (a save from before the setting existed) or unreadable: the default. */
  restore(saved: SavedMouse): void {
    const value = saved?.autoLock;
    this.set({ autoLock: typeof value === "boolean" ? value : AUTO_LOCK_DEFAULT });
  }

  /** Nothing when it's the default. */
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
