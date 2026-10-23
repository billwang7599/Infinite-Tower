import { BattleHud } from "./hud/BattleHud.js";
import { FieldHud } from "./hud/FieldHud.js";
import { Fade } from "./overlays/Fade.js";
import { Toasts } from "./overlays/Toasts.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { UiActions, UiSettings, UiState } from "./state.js";
import { useStore } from "./useStore.js";

/** Later children draw on top: HUD, toasts, the fade, the settings, then the title screen. */
export function App({ ui, settings, actions }: { ui: UiState; settings: UiSettings; actions: UiActions }) {
  const { bindings, cameraSettings } = settings;
  const mode = useStore(ui.screen, (s) => s.mode);
  return (
    <>
      {mode === "field" && <FieldHud hud={ui.field} openSettings={ui.openSettings} />}
      {mode === "battle" && <BattleHud hud={ui.battle} bindings={bindings} />}
      <Toasts toasts={ui.toasts} dismiss={ui.dismissToast} />
      <Fade screen={ui.screen} />
      {mode !== null && (
        <SettingsScreen
          settings={ui.settings} open={ui.openSettings} close={ui.closeSettings}
          bindings={bindings} cameraSettings={cameraSettings} returnToTitle={actions.returnToTitle}
        />
      )}
      <TitleScreen title={ui.title} play={actions.play} />
    </>
  );
}
