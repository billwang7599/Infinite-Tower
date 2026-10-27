import { BattleHud } from "./hud/BattleHud.js";
import { OverworldHud } from "./hud/OverworldHud.js";
import { panelWidthPx } from "./hud/layout.js";
import { Announcement } from "./notifications/Announcement.js";
import { Notices } from "./notifications/Notices.js";
import { Fade } from "./overlays/Fade.js";
import { CreationScreen } from "./screens/creation/CreationScreen.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { Settings } from "../settings/settings.js";
import { inWorld, type UiActions, type UiState } from "./state.js";
import { useStore } from "./useStore.js";

/**
 * Later children draw on top: HUD, notices and the banner, the fade, the settings, character creation, then the
 * title screen. The HUD and the settings only exist once the title has cleared off the world and the player has a
 * character. The notices keep clear of the overworld HUD's side panel and Rest button. Creation is there as soon
 * as a game runs without one, under the title, so the title's white clears onto its white.
 */
export function App({ ui, settings, actions }: { ui: UiState; settings: Settings; actions: UiActions }) {
  const mode = useStore(ui.screen, (s) => s.mode);
  const phase = useStore(ui.title, (s) => s.phase);
  const creating = useStore(ui.creation, (s) => s.open);
  const panel = useStore(ui.overworldPanel, (s) => s.open);
  const bagCols = useStore(ui.overworld, (s) => s.bag.cols);
  const nearCampfire = useStore(ui.overworld, (s) => s.nearCampfire);
  const playing = inWorld(mode, phase) && !creating;
  const overworldHud = playing && mode === "overworld";
  return (
    <>
      {playing && (
        <>
          {mode === "overworld" && (
            <OverworldHud
              hud={ui.overworld} bindings={settings.bindings} ping={ui.ping} hudSettings={settings.hud}
              settingsScreen={ui.settingsScreen}
              panels={ui.overworldPanel} togglePanel={ui.toggleOverworldPanel} closePanel={ui.closeOverworldPanel}
              openSettings={ui.openSettings} rest={actions.rest} useItem={actions.useItem} moveItem={actions.moveItem}
            />
          )}
          {mode === "battle" && (
            <BattleHud hud={ui.battle} bindings={settings.bindings} ping={ui.ping} hudSettings={settings.hud} />
          )}
        </>
      )}
      <Notices
        notices={ui.notifications.notices} dismiss={ui.notifications.dismissNotice}
        besidePanelPx={overworldHud && panel ? panelWidthPx(panel, bagCols) : null}
        aboveRestButton={overworldHud && nearCampfire}
      />
      <Announcement announcement={ui.notifications.announcement} dismiss={ui.notifications.dismissAnnouncement} />
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
