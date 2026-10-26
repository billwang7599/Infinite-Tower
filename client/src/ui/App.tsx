import { BattleHud } from "./hud/BattleHud.js";
import { OverworldHud } from "./hud/OverworldHud.js";
import { Fade } from "./overlays/Fade.js";
import { Toasts } from "./overlays/Toasts.js";
import { CreationScreen } from "./screens/creation/CreationScreen.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { Settings } from "../settings/settings.js";
import { inWorld, type UiActions, type UiState } from "./state.js";
import { useStore } from "./useStore.js";

/**
 * Later children draw on top: HUD, toasts, the fade, the settings, character creation, then the title screen. The
 * HUD and the settings only exist once the title has cleared off the world and the player has a character.
 * Creation is there as soon as a game runs without one, under the title, so the title's white clears onto its white.
 */
export function App({ ui, settings, actions }: { ui: UiState; settings: Settings; actions: UiActions }) {
  const mode = useStore(ui.screen, (s) => s.mode);
  const phase = useStore(ui.title, (s) => s.phase);
  const creating = useStore(ui.creation, (s) => s.open);
  const playing = inWorld(mode, phase) && !creating;
  return (
    <>
      {playing && (
        <>
          {mode === "overworld" && (
            <OverworldHud
              hud={ui.overworld} bindings={settings.bindings} settingsScreen={ui.settingsScreen}
              panels={ui.overworldPanel} togglePanel={ui.toggleOverworldPanel} closePanel={ui.closeOverworldPanel}
              openSettings={ui.openSettings} rest={actions.rest} useItem={actions.useItem} moveItem={actions.moveItem}
            />
          )}
          {mode === "battle" && <BattleHud hud={ui.battle} bindings={settings.bindings} />}
        </>
      )}
      <Toasts toasts={ui.toasts} dismiss={ui.dismissToast} />
      <Fade screen={ui.screen} />
      {playing && (
        <SettingsScreen
          screen={ui.settingsScreen} open={ui.openSettings} close={ui.closeSettings}
          settings={settings} returnToTitle={actions.returnToTitle}
        />
      )}
      {mode !== null && (
        <CreationScreen
          creation={ui.creation} overworld={ui.overworld} title={ui.title} active={inWorld(mode, phase)}
          save={actions.saveCharacter} close={ui.closeCreation}
        />
      )}
      <TitleScreen title={ui.title} actions={actions} />
    </>
  );
}
