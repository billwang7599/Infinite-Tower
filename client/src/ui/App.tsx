import { BattleHud } from "./hud/BattleHud.js";
import { OverworldHud } from "./hud/OverworldHud.js";
import { panelWidthPx } from "./hud/layout.js";
import { Announcement } from "./notifications/Announcement.js";
import { Notices } from "./notifications/Notices.js";
import { CreationScreen } from "./screens/creation/CreationScreen.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import type { Actions } from "../core/actions.js";
import type { Settings } from "../settings/settings.js";
import { inWorld, type ScreenState, type UiActions, type UiState } from "./state.js";
import type { Store } from "./store.js";
import { useStore } from "./useStore.js";

/**
 * Later children draw on top. The HUD and the settings only exist once the title has cleared off the world and the
 * player has a character. Creation is there as soon as a game runs without one, under the title, so the title's white
 * clears onto its white.
 */
interface AppProps {
  ui: UiState;
  settings: Settings;
  input: Actions;
  actions: UiActions;
}

export function App({ ui, settings, input, actions }: AppProps) {
  const mode = useStore(ui.screen, (s) => s.mode);
  const phase = useStore(ui.title, (s) => s.phase);
  const creating = useStore(ui.creation, (s) => s.open);
  const panel = useStore(ui.overworldPanel, (s) => s.open);
  const gear = useStore(ui.overworld, (s) => s.gear);
  const nearCampfire = useStore(ui.overworld, (s) => s.nearCampfire);
  const playing = inWorld(mode, phase) && !creating;
  const overworldHud = playing && mode === "overworld";
  return (
    <>
      {playing && (
        <>
          {mode === "overworld" && (
            <OverworldHud
              hud={ui.overworld} input={input} ping={ui.ping} hudSettings={settings.hud}
              settingsScreen={ui.settingsScreen}
              panels={ui.overworldPanel} togglePanel={ui.toggleOverworldPanel} closePanel={ui.closeOverworldPanel}
              openSettings={ui.openSettings} rest={actions.rest} useItem={actions.useItem} moveItem={actions.moveItem}
              spells={ui.spells} spellbookScreen={ui.spellbookScreen} saveSpell={actions.saveSpell}
            />
          )}
          {mode === "battle" && (
            <BattleHud
              hud={ui.battle} bindings={settings.bindings} ping={ui.ping} hudSettings={settings.hud} spells={ui.spells}
              chant={ui.chant} input={input} castSpell={actions.castSpell} saveSpell={actions.saveSpell}
              bag={{
                open: ui.battleBag, toggle: ui.toggleBattleBag, close: ui.closeBattleBag, overworld: ui.overworld,
                settingsScreen: ui.settingsScreen, spellbookScreen: ui.spellbookScreen, moveItem: actions.moveItem,
              }}
            />
          )}
        </>
      )}
      <Notices
        notices={ui.notifications.notices} dismiss={ui.notifications.dismissNotice}
        besidePanelPx={overworldHud && panel ? panelWidthPx(panel, gear) : null}
        aboveRestButton={overworldHud && nearCampfire}
      />
      <Announcement announcement={ui.notifications.announcement} dismiss={ui.notifications.dismissAnnouncement} />
      <Fade screen={ui.screen} />
      {playing && (
        <SettingsScreen
          screen={ui.settingsScreen} open={ui.openSettings} close={ui.closeSettings}
          settings={settings} input={input} returnToTitle={actions.returnToTitle}
        />
      )}
      {mode !== null && (
        <CreationScreen
          creation={ui.creation} overworld={ui.overworld} title={ui.title} active={inWorld(mode, phase)}
          input={input} save={actions.saveCharacter} close={ui.closeCreation}
        />
      )}
      <TitleScreen title={ui.title} input={input} actions={actions} />
    </>
  );
}

/** The flash / fade between modes. No CSS transition: game/transition.ts sets the opacity every frame. */
function Fade({ screen }: { screen: Store<ScreenState> }) {
  const color = useStore(screen, (s) => s.fadeColor);
  const opacity = useStore(screen, (s) => s.fadeOpacity);
  return <div id="fade" className="pointer-events-none fixed inset-0" style={{ background: color, opacity }} />;
}
