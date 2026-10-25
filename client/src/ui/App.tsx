import { BattleHud } from "./hud/BattleHud.js";
import { FieldHud } from "./hud/FieldHud.js";
import { Fade } from "./overlays/Fade.js";
import { Toasts } from "./overlays/Toasts.js";
import { CharacterEditor } from "./screens/character/CharacterEditor.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { Settings } from "../settings/settings.js";
import { inWorld, type UiActions, type UiState } from "./state.js";
import { useStore } from "./useStore.js";

/**
 * Later children draw on top: HUD, toasts, the fade, the settings, the character editor, then the title screen.
 * The HUD and the screens that take keys and focus only exist once the title has cleared off the world.
 */
export function App({ ui, settings, actions }: { ui: UiState; settings: Settings; actions: UiActions }) {
  const mode = useStore(ui.screen, (s) => s.mode);
  const phase = useStore(ui.title, (s) => s.phase);
  return (
    <>
      {inWorld(mode, phase) && (
        <>
          {mode === "field" && (
            <FieldHud
              hud={ui.field} bindings={settings.bindings}
              settingsScreen={ui.settingsScreen} characterScreen={ui.characterScreen}
              openSettings={ui.openSettings} editCharacter={ui.openCharacterEditor} rest={actions.rest}
              useItem={actions.useItem}
            />
          )}
          {mode === "battle" && <BattleHud hud={ui.battle} bindings={settings.bindings} />}
        </>
      )}
      <Toasts toasts={ui.toasts} dismiss={ui.dismissToast} />
      <Fade screen={ui.screen} />
      {inWorld(mode, phase) && (
        <>
          <SettingsScreen
            screen={ui.settingsScreen} open={ui.openSettings} close={ui.closeSettings}
            settings={settings} returnToTitle={actions.returnToTitle}
          />
          <CharacterEditor
            screen={ui.characterScreen} field={ui.field} title={ui.title} close={ui.closeCharacterEditor}
            actions={actions}
          />
        </>
      )}
      <TitleScreen title={ui.title} actions={actions} />
    </>
  );
}
