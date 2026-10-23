import { useEffect } from "react";
import type { KeyBindings } from "../../settings/bindings.js";
import type { SettingsScreenState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

export type Panel = "character" | "inventory";

/**
 * The field's panel keys (field.character, field.inventory) toggle their panels. Not while Settings is open (the
 * key may be getting rebound) or while typing in a text field (the character editor's name).
 */
export function usePanelKeys(bindings: KeyBindings, settingsScreen: Store<SettingsScreenState>, toggle: (p: Panel) => void): void {
  const characterKeys = useStore(bindings, (b) => b.field.character);
  const inventoryKeys = useStore(bindings, (b) => b.field.inventory);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || settingsScreen.get().open || e.target instanceof HTMLInputElement) return;
      if (characterKeys.includes(e.code)) toggle("character");
      else if (inventoryKeys.includes(e.code)) toggle("inventory");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [characterKeys, inventoryKeys, settingsScreen, toggle]);
}
