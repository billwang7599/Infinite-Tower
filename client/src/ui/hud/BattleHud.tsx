import { NO_PILE, type Gear } from "@infinite-tower/shared";
import { useMemo } from "react";
import { useGame } from "../context.js";
import { Bar } from "../components/Bar.js";
import { Confirm } from "../components/Confirm.js";
import { useAction } from "../components/useAction.js";
import { keyName } from "../keyNames.js";
import { ChantPopup } from "../skills/ChantPopup.js";
import { Hotbar } from "../skills/Hotbar.js";
import { useStore } from "../useStore.js";
import { Hud, type HudMode } from "./Hud.js";
import { StatusRow } from "./StatusRow.js";

/** The dark band behind the result, fading out above and below. */
const RESULT_BAND = "bg-[linear-gradient(transparent,#000b_25%,#000b_75%,transparent)]";

const NO_CLOTH: Gear["cloth"] = { cols: 0, rows: 0, items: [] };

const BATTLE: HudMode = {
  hud: (ui) => ui.battle,
  panels: ["inventory"],
  useBag: () => {
    const { battle: hud, you } = useGame().ui;
    const carried = useStore(hud, (s) => s.carried);
    const afterFight = useStore(hud, (s) => s.afterFight);
    const served = useStore(you, (s) => s.gear);
    const writingPage = useStore(hud, (s) => s.writingPage);
    const canHeal = useStore(hud, (s) => s.hpFraction < 1);
    const usingInFight = useStore(hud, (s) => s.using);
    const usingServed = useStore(you, (s) => s.using);
    // After a win the bag is the server's, as on the overworld, with the drops opened beside it.
    const gear = useMemo(
      () => (afterFight ? { ...served, cloth: NO_CLOTH } : { ...carried, cloth: NO_CLOTH, pile: NO_PILE }),
      [afterFight, served, carried],
    );
    return { gear, using: afterFight ? usingServed : usingInFight, canHeal, writingPage };
  },
  bagOpens: (ui) => ui.battle.get().result === "fighting" || ui.battle.get().afterFight,
};

export function BattleHud() {
  return (
    <Hud id="battle-hud" mode={BATTLE}>
      <BossBar />
      <Hotbar />
      <ResultBanner />
      <ArenaTimer />
      <ChantPopup />
      <LeaveArena />
    </Hud>
  );
}

function ArenaTimer() {
  const { ui: { battle: hud }, settings: { bindings } } = useGame();
  const afterFight = useStore(hud, (s) => s.afterFight);
  const secondsLeft = useStore(hud, (s) => s.arenaSecondsLeft);
  const leaveKey = useStore(bindings, (s) => s.battle.leave[0]);
  if (!afterFight) return null;
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  return (
    <div id="arena-timer" className="absolute top-3 left-1/2 -translate-x-1/2 text-center">
      <div className="font-title text-lg tracking-wide">
        The arena closes in <span className="text-victory">{clock}</span>
      </div>
      {leaveKey && <div className="text-xs opacity-70">Press {keyName(leaveKey)} to leave</div>}
    </div>
  );
}

function LeaveArena() {
  const { ui: { leaveArena: asking }, input, actions } = useGame();
  const leave = () => actions.leaveBattle(true);
  const open = useStore(asking, (s) => s.asking);
  const stay = () => asking.set({ asking: false });
  useAction(input, ["leave", "stayInArena"], (action, repeat) => {
    if (repeat || !open) return false;
    if (action === "leave") leave();
    else stay();
  });
  if (!open) return null;
  return (
    <Confirm
      id="leave-arena" title="Leave the drops behind?" yes="Leave" no="Stay"
      answer={(yes) => (yes ? leave() : stay())} className="top-1/3 bg-black/80 px-6 py-4"
    >
      <div className="mb-3 text-sm opacity-80">
        Once everyone has left, what's left will lie where the fight began, for anyone to take.
      </div>
    </Confirm>
  );
}

function BossBar() {
  const hud = useGame().ui.battle;
  const name = useStore(hud, (s) => s.enemyName);
  const hpFraction = useStore(hud, (s) => s.enemyHpFraction);
  const alive = useStore(hud, (s) => s.enemyAlive);
  const statuses = useStore(hud, (s) => s.enemyStatuses);
  return (
    <div
      className={`absolute bottom-12 left-1/2 w-[min(640px,70%,100%-20rem)] -translate-x-1/2 transition-opacity duration-600 ${
        alive ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mb-1 flex items-end justify-between gap-3">
        <div id="boss-name" className="font-title text-[17px] font-medium tracking-wide">
          <span className="mr-2 text-[11px] text-victory/80">◆</span>
          {name}
        </div>
        <StatusRow id="enemy-statuses" icons={statuses} className="justify-end" />
      </div>
      <Bar fraction={hpFraction} fill="from-boss to-boss-dark" chip className="h-3" />
    </div>
  );
}

function ResultBanner() {
  const { ui: { battle: hud }, settings: { bindings } } = useGame();
  const result = useStore(hud, (s) => s.result);
  const show = useStore(hud, (s) => s.showResult);
  const leaveKey = useStore(bindings, (s) => s.battle.leave[0]);
  const evenMatch = useStore(hud, (s) => s.duel || s.spar);
  const died = result === "lost";
  return (
    <div
      className={`absolute inset-x-0 top-[10%] flex flex-col items-center py-5 ${RESULT_BAND} transition-opacity ${
        show ? "opacity-100" : "opacity-0"
      } duration-1200`}
    >
      <div className={`font-title text-4xl font-normal tracking-[4px] ${died ? "text-died" : "text-victory"}`}>
        {evenMatch ? (died ? "DEFEATED" : "VICTORY") : died ? "YOU DIED" : "PREY SLAUGHTERED"}
      </div>
      {leaveKey && <div className="mt-2 font-normal opacity-80">Press {keyName(leaveKey)} to continue</div>}
    </div>
  );
}
