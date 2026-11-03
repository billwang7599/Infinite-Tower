import type { ReactNode } from "react";
import { useGame } from "../context.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { useStore } from "../useStore.js";
import { COMPASS } from "./compassMarks.js";
import { Compass } from "./Compass.js";
import { Hud, type HudMode } from "./Hud.js";
import { BagIcon, BookIcon, GearIcon, PersonIcon } from "./icons.js";
import { fitCompass, MARGIN_PX, useStageSize } from "./layout.js";

const OVERWORLD: HudMode = {
  hud: (ui) => ui.overworld,
  panels: ["character", "inventory"],
  useBag: () => {
    const { ui } = useGame();
    const gear = useStore(ui.you, (s) => s.gear);
    const using = useStore(ui.you, (s) => s.using);
    const canHeal = useStore(ui.overworld, (s) => s.hpFraction < 1);
    const shop = useStore(ui.shop, (s) => s.view);
    return { gear, using, canHeal, shop };
  },
};

export function OverworldHud() {
  const { ui, input, actions } = useGame();
  const compassTop = fitCompass(useStageSize()).top;
  useAction(input, ["challenge"], (_action, repeat) => {
    if (!repeat) actions.request({ t: "challenge" });
  });
  return (
    <Hud
      id="overworld-hud" mode={OVERWORLD} aboveBars={<Name />} belowBars={<Wins />} beforePing={<RegionName />}
      afterPing={
        <>
          <HudButton id="inventory-button" label="Inventory" onClick={() => ui.togglePanel("inventory")}>
            <BagIcon />
          </HudButton>
          <HudButton id="character-button" label="Character" onClick={() => ui.togglePanel("character")}>
            <PersonIcon />
          </HudButton>
          <HudButton id="questbook-button" label="Questbook" onClick={ui.toggleQuestbook}>
            <BookIcon />
          </HudButton>
          <HudButton id="settings-button" label="Settings" onClick={ui.openSettings}>
            <GearIcon />
          </HudButton>
        </>
      }
    >
      <Compass top={compassTop} />
      <ChallengeNotice top={Math.max(CHALLENGE_TOP_PX, compassTop + COMPASS.heightPx + MARGIN_PX)} />
    </Hud>
  );
}

function Name() {
  const name = useStore(useGame().ui.you, (s) => s.character?.name);
  return name ? <div id="overworld-name" className="mb-1 font-title text-[15px] tracking-wide">{name}</div> : null;
}

function Wins() {
  const wins = useStore(useGame().ui.you, (s) => s.wins);
  return (
    <div id="overworld-wins" className="text-[13px] font-normal">
      Foes defeated: <span className="font-semibold text-victory">{wins}</span>
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
