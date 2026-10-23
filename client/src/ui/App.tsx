import { BattleHud } from "./hud/BattleHud.js";
import { FieldHud } from "./hud/FieldHud.js";
import { Fade } from "./overlays/Fade.js";
import { Toasts } from "./overlays/Toasts.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { UiActions, UiState } from "./state.js";
import { useStore } from "./useStore.js";

/** Later children draw on top: HUD, toasts, the fade, then the title screen. */
export function App({ ui, actions }: { ui: UiState; actions: UiActions }) {
  const mode = useStore(ui.screen, (s) => s.mode);
  return (
    <>
      {mode === "field" && <FieldHud hud={ui.field} />}
      {mode === "battle" && <BattleHud hud={ui.battle} />}
      <Toasts toasts={ui.toasts} dismiss={ui.dismissToast} />
      <Fade screen={ui.screen} />
      <TitleScreen title={ui.title} play={actions.play} />
    </>
  );
}
