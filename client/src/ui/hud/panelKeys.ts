import type { KeyBindings } from "../../settings/bindings.js";
import { useKeydown } from "../components/useKeydown.js";
import type { OverworldPanel } from "../state.js";
import type { Store } from "../store.js";

/**
 * The overworld's panel keys (overworld.character, overworld.inventory) toggle their panels. Not while a screen
 * covers the overworld (Settings, where the key may be getting rebound) or while typing in a text field.
 */
export function usePanelKeys(
  bindings: KeyBindings, screens: readonly Store<{ open: boolean }>[], toggle: (p: OverworldPanel) => void,
): void {
  useKeydown((e) => {
    if (e.repeat || e.target instanceof HTMLInputElement || screens.some((s) => s.get().open)) return;
    const keys = bindings.get().overworld;
    if (keys.character.includes(e.code)) toggle("character");
    else if (keys.inventory.includes(e.code)) toggle("inventory");
  });
}
