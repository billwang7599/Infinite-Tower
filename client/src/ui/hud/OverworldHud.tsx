import type { ReactNode } from "react";
import { useGame } from "../context.js";
import { Confirm } from "../components/Confirm.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { useAction } from "../components/useAction.js";
import { useStore } from "../useStore.js";
import { COMPASS } from "./compassMarks.js";
import { Compass } from "./Compass.js";
import { Hud, type HudMode } from "./Hud.js";
import { BagIcon, BookIcon, GearIcon, PersonIcon } from "./icons.js";
import { fitCompass, MARGIN_PX, useStageSize } from "./layout.js";
import { RealmSeal } from "./RealmSeal.js";

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
      id="overworld-hud" mode={OVERWORLD} aboveBars={<Name />} beforePing={<RegionName />}
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
  const { you } = useGame().ui;
  const name = useStore(you, (s) => s.character?.name);
  const core = useStore(you, (s) => s.core);
  if (!name) return null;
  return (
    <div className="mb-1.5 flex items-center gap-2 text-[13px] tracking-[0.24em] uppercase">
      <RealmSeal core={core} />
      <span id="overworld-name">{name}</span>
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
    <Confirm
      id="challenge-notice" title={`${from} challenges you to a duel`} yes="Accept" no="Decline" answer={answer}
      top={top} className="px-6 py-4"
    />
  );
}

function RegionName() {
  const name = useStore(useGame().ui.overworld, (s) => s.regionName);
  return <div id="overworld-region" className="text-sm tracking-[0.24em] uppercase">{name}</div>;
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
        "pointer-events-auto flex size-9 cut-6 clip-cut cursor-pointer items-center justify-center bg-stone/80 "
        + "text-bone inset-ring inset-ring-bone/20 transition-colors hover:text-cinnabar"
      }
    >
      {children}
    </button>
  );
}
