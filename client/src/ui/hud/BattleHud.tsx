import {
  coreStats, NO_PILE, type Gear, type Skill, type Spot, type UseSpot, type WeaponId,
} from "@infinite-tower/shared";
import { useMemo } from "react";
import type { Actions } from "../../core/actions.js";
import type { KeyBindings } from "../../settings/bindings.js";
import type { HudSettings } from "../../settings/hud.js";
import { Bar } from "../components/Bar.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { BUTTON } from "../components/styles.js";
import { keyName } from "../keyNames.js";
import type { ChantState } from "../skills/chant.js";
import { useAction } from "../components/useAction.js";
import { ChantPopup } from "../skills/ChantPopup.js";
import { Hotbar } from "../skills/Hotbar.js";
import { SkillbookScreen } from "../skills/SkillbookScreen.js";
import type { BattleHudState, OverworldHudState, PingState, SettingsScreenState, SkillsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { HudLayer } from "./HudLayer.js";
import { InteractButton } from "./InteractButton.js";
import { InventoryPanel } from "./inventory/InventoryPanel.js";
import { Ping } from "./Ping.js";

type HudProps = { hud: Store<BattleHudState> };

/** The dark band behind the result, fading out above and below. */
const RESULT_BAND = "bg-[linear-gradient(transparent,#000b_25%,#000b_75%,transparent)]";

interface BattleHudProps extends HudProps {
  bindings: KeyBindings;
  ping: Store<PingState>;
  hudSettings: HudSettings;
  skills: Store<SkillsState>;
  chant: Store<ChantState>;
  input: Actions;
  castSkill: (skill: Skill) => void;
  saveSkill: (page: number, skill: Skill) => void;
  interact: () => void;
  leaving: LeavingProps;
  bag: BagProps;
}

interface LeavingProps {
  asking: Store<{ asking: boolean }>;
  leave: () => void;
}

interface BagProps {
  open: Store<{ open: boolean }>;
  toggle: () => void;
  close: () => void;
  overworld: Store<OverworldHudState>;
  settingsScreen: Store<SettingsScreenState>;
  skillbookScreen: Store<{ open: boolean }>;
  moveItem: (from: Spot, to: Spot, turned: boolean) => void;
  tooWeak: (item: WeaponId) => void;
  useItem: (at: UseSpot) => void;
}

export function BattleHud(props: BattleHudProps) {
  const { hud, bindings, ping, hudSettings, skills } = props;
  const dropInView = useStore(hud, (s) => s.dropInView);
  useAction(props.input, ["interact"], (_action, repeat) => {
    if (!repeat) props.interact();
  });
  return (
    <HudLayer id="battle-hud">
      <Vitals hud={hud} />
      <div className="absolute top-3 right-4">
        <Ping ping={ping} hud={hudSettings} />
      </div>
      <BossBar hud={hud} />
      <Hotbar skills={skills} bindings={bindings} />
      <ResultBanner hud={hud} bindings={bindings} />
      <ArenaTimer hud={hud} bindings={bindings} />
      <InteractButton interaction={dropInView ? "openPile" : null} interact={props.interact} />
      <ChantPopup
        chant={props.chant} skills={skills} hud={hud} input={props.input} cast={props.castSkill} save={props.saveSkill}
      />
      <BattleBag {...props.bag} hud={hud} input={props.input} skills={skills} saveSkill={props.saveSkill} />
      <LeaveArena {...props.leaving} input={props.input} />
    </HudLayer>
  );
}

const NO_CLOTH: Gear["cloth"] = { cols: 0, rows: 0, items: [] };

type BattleBagProps = BagProps & HudProps & {
  input: Actions;
  skills: Store<SkillsState>;
  saveSkill: (page: number, skill: Skill) => void;
};

function BattleBag(props: BattleBagProps) {
  const { hud, input, skillbookScreen } = props;
  const open = useStore(props.open, (s) => s.open);
  const bookOpen = useStore(skillbookScreen, (s) => s.open);
  const carried = useStore(hud, (s) => s.carried);
  const afterFight = useStore(hud, (s) => s.afterFight);
  const served = useStore(props.overworld, (s) => s.gear);
  const writingPage = useStore(hud, (s) => s.writingPage);
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const usingInFight = useStore(hud, (s) => s.using);
  const usingServed = useStore(props.overworld, (s) => s.using);
  const core = useStore(props.overworld, (s) => s.core);
  const stats = useMemo(() => core && coreStats(core), [core]);
  // After a win the bag is the server's, as on the overworld, with the drops opened beside it.
  const gear = useMemo(
    () => (afterFight ? { ...served, cloth: NO_CLOTH } : { ...carried, cloth: NO_CLOTH, pile: NO_PILE }),
    [afterFight, served, carried],
  );
  useAction(input, ["inventory"], (_action, repeat) => {
    if (!repeat && (open || hud.get().result === "fighting" || hud.get().afterFight)) props.toggle();
  });
  if (!open) return null;
  return (
    <>
      <InventoryPanel
        gear={gear} stats={stats} canHeal={!fullHp} using={afterFight ? usingServed : usingInFight} input={input}
        settingsScreen={props.settingsScreen} use={props.useItem} move={props.moveItem} tooWeak={props.tooWeak}
        openSkillbook={() => skillbookScreen.set({ open: true })} close={props.close}
      />
      {bookOpen && (
        <SkillbookScreen
          skills={props.skills} input={input} save={props.saveSkill} writingPage={writingPage}
          close={() => skillbookScreen.set({ open: false })}
        />
      )}
    </>
  );
}

function ArenaTimer({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
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

function LeaveArena({ asking, leave, input }: LeavingProps & { input: Actions }) {
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

function Vitals({ hud }: HudProps) {
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  return (
    <div className="absolute top-3 left-4">
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} />
    </div>
  );
}

function BossBar({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.enemyName);
  const hpFraction = useStore(hud, (s) => s.enemyHpFraction);
  const alive = useStore(hud, (s) => s.enemyAlive);
  return (
    <div
      className={`absolute bottom-12 left-1/2 w-[min(640px,70%,100%-20rem)] -translate-x-1/2 transition-opacity duration-600 ${
        alive ? "opacity-100" : "opacity-0"
      }`}
    >
      <div id="boss-name" className="mb-1 font-title text-[17px] font-medium tracking-wide">{name}</div>
      <Bar fraction={hpFraction} fill="from-boss to-boss-dark" chip />
    </div>
  );
}

function ResultBanner({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
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
