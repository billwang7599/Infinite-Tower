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
import { RealmSeal } from "./RealmSeal.js";
import { StatusRow } from "./StatusRow.js";

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
      <Reticle />
    </Hud>
  );
}

function Reticle() {
  const locked = useStore(useGame().input.pointer, (s) => s.locked);
  if (!locked) return null;
  return (
    <div id="reticle" className="absolute top-1/2 left-1/2 size-[3px] -translate-1/2 bg-bone/90 ring-1 ring-pit/50" />
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
      <div className="text-[15px] font-normal tracking-[0.14em]">
        The arena closes in <span className="font-semibold">{clock}</span>
      </div>
      {leaveKey && (
        <div className="mt-0.5 text-xs tracking-[0.14em] opacity-70">Press {keyName(leaveKey)} to leave</div>
      )}
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
      answer={(yes) => (yes ? leave() : stay())} className="top-1/3 px-7 py-5"
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
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div id="boss-name" className="text-[15px] tracking-[0.26em] uppercase">{name}</div>
        <StatusRow id="enemy-statuses" icons={statuses} className="justify-end" />
      </div>
      <Bar fraction={hpFraction} fill="from-boss to-boss-dark" chip className="h-[7px]" />
    </div>
  );
}

function ResultBanner() {
  const { ui: { battle: hud, you }, settings: { bindings } } = useGame();
  const battleCore = useStore(hud, (s) => s.core);
  const savedCore = useStore(you, (s) => s.core);
  const result = useStore(hud, (s) => s.result);
  const show = useStore(hud, (s) => s.showResult);
  const leaveKey = useStore(bindings, (s) => s.battle.leave[0]);
  const match = useStore(hud, (s) => (s.duel ? "duel" : s.spar ? "spar" : null));
  const won = result !== "lost";
  return (
    <div
      className={`absolute inset-x-0 top-[10%] flex flex-col items-center transition-opacity ${
        show ? "opacity-100" : "opacity-0"
      } duration-1200`}
    >
      <div className="flex items-center gap-4 text-[32px] font-normal tracking-[0.06em] text-shadow-letterpress">
        <RealmSeal core={battleCore ?? savedCore} size="big" hollow={!won} />
        {match ? `You ${won ? "win" : "lose"} the ${match}.` : won ? "The fight is won." : "Your shell breaks."}
      </div>
      {leaveKey && (
        <div className="mt-2.5 text-[11px] tracking-[0.3em] uppercase">Press {keyName(leaveKey)} to continue</div>
      )}
    </div>
  );
}
