import type { KeyBindings } from "../../settings/bindings.js";
import { useKeydown } from "../components/useKeydown.js";
import type { SettingsScreenState } from "../state.js";
import type { Store } from "../store.js";

export type Panel = "character" | "inventory";

/**
 * The field's panel keys (field.character, field.inventory) toggle their panels. Not while Settings is open (the
 * key may be getting rebound) or while typing in a text field (the character editor's name).
 */
export function usePanelKeys(
  bindings: KeyBindings, settingsScreen: Store<SettingsScreenState>, toggle: (p: Panel) => void,
): void {
  useKeydown((e) => {
    if (e.repeat || settingsScreen.get().open || e.target instanceof HTMLInputElement) return;
    const keys = bindings.get().field;
    if (keys.character.includes(e.code)) toggle("character");
    else if (keys.inventory.includes(e.code)) toggle("inventory");
  });
}
