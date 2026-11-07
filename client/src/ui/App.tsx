import { Chat } from "./chat/Chat.js";
import { Dialogue } from "./dialogue/Dialogue.js";
import { BattleHud } from "./hud/BattleHud.js";
import { CoreCard } from "./hud/CoreCard.js";
import { OverworldHud } from "./hud/OverworldHud.js";
import { Notices } from "./notifications/Notices.js";
import { AdminPanel } from "./screens/admin/AdminPanel.js";
import { CreationScreen } from "./screens/creation/CreationScreen.js";
import { QuestbookScreen } from "./screens/questbook/QuestbookScreen.js";
import { SettingsScreen } from "./screens/settings/SettingsScreen.js";
import { TitleScreen } from "./screens/title/TitleScreen.js";
import { useGame } from "./context.js";
import { inWorld, type ScreenState } from "./state.js";
import type { Store } from "./store.js";
import { useStore } from "./useStore.js";

/**
 * Later children draw on top. The HUD and the settings only exist once the title has cleared off the world and the
 * player has a character. Creation is there as soon as a game runs without one, under the title, so the title's white
 * clears onto its white.
 */
export function App() {
  const { ui } = useGame();
  const mode = useStore(ui.screen, (s) => s.mode);
  const phase = useStore(ui.title, (s) => s.phase);
  const creating = useStore(ui.creation, (s) => s.open);
  const panel = useStore(ui.panel, (s) => s.open);
  const panelWidthPx = useStore(ui.panel, (s) => s.widthPx);
  const interaction = useStore(ui.overworld, (s) => s.interaction);
  const playing = inWorld(mode, phase) && !creating;
  const overworldHud = playing && mode === "overworld";
  const cheatsAllowed = import.meta.env.DEV;
  return (
    <>
      {playing && (
        <>
          {mode === "overworld" && <OverworldHud />}
          {mode === "battle" && <BattleHud />}
          <CoreCard />
          <Chat commands={cheatsAllowed} />
          <Dialogue />
        </>
      )}
      <Notices
        notices={ui.notifications.notices} dismiss={ui.notifications.dismissNotice}
        besidePanelPx={overworldHud && panel ? panelWidthPx : null}
        aboveRestButton={overworldHud && interaction !== null}
      />
      <Fade screen={ui.screen} />
      {playing && <QuestbookScreen />}
      {playing && cheatsAllowed && <AdminPanel />}
      {playing && <SettingsScreen />}
      {mode !== null && <CreationScreen />}
      <TitleScreen />
    </>
  );
}

/** The flash / fade between modes. No CSS transition: game/transition.ts sets the opacity every frame. */
function Fade({ screen }: { screen: Store<ScreenState> }) {
  const color = useStore(screen, (s) => s.fadeColor);
  const opacity = useStore(screen, (s) => s.fadeOpacity);
  return <div id="fade" className="pointer-events-none fixed inset-0" style={{ background: color, opacity }} />;
}
