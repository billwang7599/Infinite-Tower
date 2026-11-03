import { coreStats, NO_PILE, type Gear } from "@infinite-tower/shared";
import { useMemo } from "react";
import { useGame } from "../context.js";
import { Bar } from "../components/Bar.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { BUTTON } from "../components/styles.js";
import { keyName } from "../keyNames.js";
import { useAction } from "../components/useAction.js";
import { ChantPopup } from "../skills/ChantPopup.js";
import { Hotbar } from "../skills/Hotbar.js";
import { SkillbookScreen } from "../skills/SkillbookScreen.js";
import { useStore } from "../useStore.js";
import { HudLayer } from "./HudLayer.js";
import { InteractButton } from "./InteractButton.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { Ping } from "./Ping.js";
import { StatusRow } from "./StatusRow.js";

/** The dark band behind the result, fading out above and below. */
const RESULT_BAND = "bg-[linear-gradient(transparent,#000b_25%,#000b_75%,transparent)]";

export function BattleHud() {
  const { ui: { battle: hud }, input, actions } = useGame();
  const dropInView = useStore(hud, (s) => s.dropInView);
  useAction(input, ["interact"], (_action, repeat) => {
    if (!repeat) actions.interact();
  });
  return (
    <HudLayer id="battle-hud">
      <Vitals />
      <div className="absolute top-3 right-4">
        <Ping />
      </div>
      <BossBar />
      <Hotbar />
      <ResultBanner />
      <ArenaTimer />
      <InteractButton interaction={dropInView ? "openPile" : null} interact={actions.interact} />
      <ChantPopup />
      <BattleBag />
      <LeaveArena />
    </HudLayer>
  );
}

const NO_CLOTH: Gear["cloth"] = { cols: 0, rows: 0, items: [] };

function BattleBag() {
  const { ui, input } = useGame();
  const { battle: hud, you } = ui;
  const open = useStore(ui.battleBag, (s) => s.open);
  const bookOpen = useStore(ui.skillbookScreen, (s) => s.open);
  const carried = useStore(hud, (s) => s.carried);
  const afterFight = useStore(hud, (s) => s.afterFight);
  const served = useStore(you, (s) => s.gear);
  const writingPage = useStore(hud, (s) => s.writingPage);
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const usingInFight = useStore(hud, (s) => s.using);
  const usingServed = useStore(you, (s) => s.using);
  const core = useStore(you, (s) => s.core);
  const stats = useMemo(() => core && coreStats(core), [core]);
  // After a win the bag is the server's, as on the overworld, with the drops opened beside it.
  const gear = useMemo(
    () => (afterFight ? { ...served, cloth: NO_CLOTH } : { ...carried, cloth: NO_CLOTH, pile: NO_PILE }),
    [afterFight, served, carried],
  );
  useAction(input, ["inventory"], (_action, repeat) => {
    if (!repeat && (open || hud.get().result === "fighting" || hud.get().afterFight)) ui.toggleBattleBag();
  });
  if (!open) return null;
  return (
    <>
      <InventoryPanel
        gear={gear} stats={stats} canHeal={!fullHp} using={afterFight ? usingServed : usingInFight}
        close={ui.closeBattleBag}
      />
      {bookOpen && <SkillbookScreen writingPage={writingPage} />}
    </>
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
    <div
      id="leave-arena"
      className={
        "pointer-events-auto absolute top-1/3 left-1/2 -translate-x-1/2 rounded-sm border border-victory/50 "
        + "bg-black/80 px-6 py-4 text-center"
      }
    >
      <div className="mb-1 font-title text-lg tracking-wide">Leave the drops behind?</div>
      <div className="mb-3 text-sm opacity-80">
        Once everyone has left, what's left will lie where the fight began, for anyone to take.
      </div>
      <div className="flex justify-center gap-3">
        <button type="button" id="leave-arena-confirm" {...NO_FOCUS} className={BUTTON.primary} onClick={leave}>
          Leave
        </button>
        <button type="button" id="leave-arena-stay" {...NO_FOCUS} className={BUTTON.plain} onClick={stay}>
          Stay
        </button>
      </div>
    </div>
  );
}

function Vitals() {
  const hud = useGame().ui.battle;
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  const hp = useStore(hud, (s) => s.hp);
  const hpMax = useStore(hud, (s) => s.hpMax);
  const statuses = useStore(hud, (s) => s.statuses);
  return (
    <div className="absolute top-3 left-4">
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} hp={hp} hpMax={hpMax} />
      <StatusRow id="my-statuses" icons={statuses} className="mt-1 w-75" />
    </div>
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
