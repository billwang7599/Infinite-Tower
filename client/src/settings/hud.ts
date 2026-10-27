/** For now just whether the ping shows. */
import type { SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedHud = SavedSettings["hud"];

interface HudPrefs {
  showPing: boolean;
}

const SHOW_PING_DEFAULT = true;

export class HudSettings extends Store<HudPrefs> {
  constructor() {
    super({ showPing: SHOW_PING_DEFAULT });
  }

  restore(saved: SavedHud): void {
    const value = saved?.showPing;
    this.set({ showPing: typeof value === "boolean" ? value : SHOW_PING_DEFAULT });
  }

  toSaved(): NonNullable<SavedHud> {
    return this.isDefault() ? {} : { showPing: this.get().showPing };
  }

  setShowPing(on: boolean): void {
    this.set({ showPing: on });
  }

  isDefault(): boolean {
    return this.get().showPing === SHOW_PING_DEFAULT;
  }
}
