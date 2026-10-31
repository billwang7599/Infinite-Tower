import { DEFAULT_COMBAT_STYLE, isCombatStyle, type CombatStyle, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedCombat = SavedSettings["combat"];

export class CombatSettings extends Store<{ style: CombatStyle }> {
  constructor() {
    super({ style: DEFAULT_COMBAT_STYLE });
  }

  restore(saved: SavedCombat): void {
    const style = saved?.style;
    this.set({ style: isCombatStyle(style) ? style : DEFAULT_COMBAT_STYLE });
  }

  toSaved(): NonNullable<SavedCombat> {
    const { style } = this.get();
    return style === DEFAULT_COMBAT_STYLE ? {} : { style };
  }

  setStyle(style: CombatStyle): void {
    this.set({ style });
  }
}
