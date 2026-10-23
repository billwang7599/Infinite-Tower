import { BattleHud } from "./hud/BattleHud.js";
import { FieldHud } from "./hud/FieldHud.js";
import { ErrorMessage } from "./overlays/ErrorMessage.js";
import { Fade } from "./overlays/Fade.js";
import { Toasts } from "./overlays/Toasts.js";
import type { UiState } from "./state.js";
import { useStore } from "./useStore.js";

/** Later children draw on top: HUD, then toasts, then the fade. */
export function App({ ui }: { ui: UiState }) {
  const mode = useStore(ui.screen, (s) => s.mode);
  return (
    <>
      {mode === "field" && <FieldHud hud={ui.field} />}
      {mode === "battle" && <BattleHud hud={ui.battle} />}
      <Toasts toasts={ui.toasts} dismiss={ui.dismissToast} />
      <Fade screen={ui.screen} />
      <ErrorMessage screen={ui.screen} />
    </>
  );
}
