import { coreStats } from "@infinite-tower/shared";
import { useMemo, type ReactNode } from "react";
import { useGame } from "../context.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { useAction } from "../components/useAction.js";
import { SkillbookScreen } from "../skills/SkillbookScreen.js";
import { useStore } from "../useStore.js";
import { CharacterPanel } from "./character/CharacterPanel.js";
import { COMPASS } from "./compassMarks.js";
import { Compass } from "./Compass.js";
import { HudLayer } from "./HudLayer.js";
import { BagIcon, BookIcon, GearIcon, PersonIcon } from "./icons.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { InteractButton } from "./InteractButton.js";
import { fitCompass, MARGIN_PX, useStageSize } from "./layout.js";
import { Ping } from "./Ping.js";

/** One side panel at a time (character or inventory). The bag stops you walking while it's open; see state.ts. */
export function OverworldHud() {
  const { ui, input, actions } = useGame();
  const { overworld: hud, you, overworldPanel: panels, toggleOverworldPanel: toggle, closeOverworldPanel: close } = ui;
  const panel = useStore(panels, (s) => s.open);
  const bookOpen = useStore(ui.skillbookScreen, (s) => s.open);
  const gear = useStore(you, (s) => s.gear);
  const core = useStore(you, (s) => s.core);
  const stats = useMemo(() => core && coreStats(core), [core]);
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const using = useStore(you, (s) => s.using);
  const interaction = useStore(hud, (s) => s.interaction);
  const shop = useStore(ui.shop, (s) => s.view);
  const shownWidth = (widthPx: number) => panels.set({ widthPx });
  const compassTop = fitCompass(useStageSize()).top;
  useAction(input, ["character", "inventory"], (panel, repeat) => {
    if (!repeat) toggle(panel);
  });
  useAction(input, ["interact"], (_action, repeat) => {
    if (!repeat) actions.interact();
  });
  useAction(input, ["challenge"], (_action, repeat) => {
    if (!repeat) actions.request({ t: "challenge" });
  });

  return (
    <HudLayer id="overworld-hud">
      <PlayerStatus />
      <Compass top={compassTop} />
      <div className="absolute top-3 right-4 flex items-center gap-3">
        <RegionName />
        <Ping />
        <HudButton id="inventory-button" label="Inventory" onClick={() => toggle("inventory")}>
          <BagIcon />
        </HudButton>
        <HudButton id="character-button" label="Character" onClick={() => toggle("character")}>
          <PersonIcon />
        </HudButton>
        <HudButton id="questbook-button" label="Questbook" onClick={ui.toggleQuestbook}>
          <BookIcon />
        </HudButton>
        <HudButton id="settings-button" label="Settings" onClick={ui.openSettings}>
          <GearIcon />
        </HudButton>
      </div>
      <InteractButton interaction={interaction} interact={actions.interact} />
      <ChallengeNotice top={Math.max(CHALLENGE_TOP_PX, compassTop + COMPASS.heightPx + MARGIN_PX)} />
      {panel === "character" && <CharacterPanel close={close} shownWidth={shownWidth} />}
      {panel === "inventory" && (
        <InventoryPanel
          gear={gear} stats={stats} canHeal={!fullHp} using={using} close={close}
          trade={shop && core && { shop, core }} shownWidth={shownWidth}
        />
      )}
      {panel === "inventory" && bookOpen && <SkillbookScreen />}
    </HudLayer>
  );
}

function PlayerStatus() {
  const { overworld: hud, you } = useGame().ui;
  const name = useStore(you, (s) => s.character?.name);
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  const wins = useStore(you, (s) => s.wins);
  return (
    <div className="absolute top-3 left-4">
      {name && <div id="overworld-name" className="mb-1 font-title text-[15px] tracking-wide">{name}</div>}
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} />
      <div id="overworld-wins" className="text-[13px] font-normal">
        Foes defeated: <span className="font-semibold text-victory">{wins}</span>
      </div>
    </div>
  );
}

const CHALLENGE_TOP_PX = 96;

function ChallengeNotice({ top }: { top: number }) {
  const { ui: { challenge }, input, actions: { answerChallenge: answer } } = useGame();
  const from = useStore(challenge, (s) => s.from);
  useAction(input, ["acceptChallenge", "declineChallenge"], (action, repeat) => {
    if (repeat || from === null) return false;
    answer(action === "acceptChallenge");
  });
  if (from === null) return null;
  return (
    <div
      id="challenge-notice" style={{ top }}
      className={
        "pointer-events-auto absolute left-1/2 -translate-x-1/2 rounded-sm border border-victory/50 "
        + "bg-black/75 px-5 py-3 text-center"
      }
    >
      <div className="mb-2 font-title text-lg tracking-wide">{from} challenges you to a duel</div>
      <div className="flex justify-center gap-3">
        <button type="button" {...NO_FOCUS} className={BUTTON.primary} onClick={() => answer(true)}>
          Accept
        </button>
        <button type="button" {...NO_FOCUS} className={BUTTON.plain} onClick={() => answer(false)}>
          Decline
        </button>
      </div>
    </div>
  );
}

function RegionName() {
  const name = useStore(useGame().ui.overworld, (s) => s.regionName);
  return <div id="overworld-region" className="font-title text-[17px] font-medium tracking-wide">{name}</div>;
}

interface HudButtonProps {
  id: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

function HudButton({ id, label, onClick, children }: HudButtonProps) {
  return (
    <button
      type="button" id={id} aria-label={label} {...NO_FOCUS} onClick={onClick}
      className={
        "pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/40 "
        + "text-white/80 transition-colors hover:bg-black/60 hover:text-white"
      }
    >
      {children}
    </button>
  );
}
