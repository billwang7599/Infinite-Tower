import { actionOf } from "../../core/actions.js";
import type { KeyBindings } from "../../settings/bindings.js";
import { useKeydown } from "../components/useKeydown.js";
import type { OverworldPanel } from "../state.js";
import type { Store } from "../store.js";

/**
 * The panel keys (general.character, general.inventory) toggle their panels. Not while a screen
 * covers the overworld (Settings, where the key may be getting rebound) or while typing in a text field.
 */
export function usePanelKeys(
  bindings: KeyBindings, screens: readonly Store<{ open: boolean }>[], toggle: (p: OverworldPanel) => void,
): void {
  useKeydown((e) => {
    if (e.repeat || e.target instanceof HTMLInputElement || screens.some((s) => s.get().open)) return;
    const action = actionOf(bindings.get(), "overworld", e.code);
    if (action === "character" || action === "inventory") toggle(action);
  });
}
