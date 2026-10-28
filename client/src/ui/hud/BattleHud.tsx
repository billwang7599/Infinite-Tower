import type { Spell } from "@infinite-tower/shared";
import type { Actions } from "../../core/actions.js";
import type { KeyBindings } from "../../settings/bindings.js";
import type { HudSettings } from "../../settings/hud.js";
import { Bar } from "../components/Bar.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { keyName } from "../keyNames.js";
import type { ChantState } from "../spells/chant.js";
import { ChantPopup } from "../spells/ChantPopup.js";
import { Hotbar } from "../spells/Hotbar.js";
import type { BattleCue, BattleHudState, PingState, SpellsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { HudLayer } from "./HudLayer.js";
import { Ping } from "./Ping.js";

type HudProps = { hud: Store<BattleHudState> };

/** The dark band behind the result, fading out above and below. */
const RESULT_BAND = "bg-[linear-gradient(transparent_38%,#000b_45%,#000b_58%,transparent_65%)]";

interface BattleHudProps extends HudProps {
  bindings: KeyBindings;
  ping: Store<PingState>;
  hudSettings: HudSettings;
  spells: Store<SpellsState>;
  chant: Store<ChantState>;
  input: Actions;
  castSpell: (spell: Spell) => void;
  saveSpell: (page: number, spell: Spell) => void;
}

export function BattleHud(props: BattleHudProps) {
  const { hud, bindings, ping, hudSettings, spells } = props;
  return (
    <HudLayer id="battle-hud">
      <Vitals hud={hud} />
      <div className="absolute top-3 right-4">
        <Ping ping={ping} hud={hudSettings} />
      </div>
      <Cue hud={hud} />
      <BossBar hud={hud} />
      <Hotbar spells={spells} bindings={bindings} />
      <ResultBanner hud={hud} bindings={bindings} />
      <ChantPopup
        chant={props.chant} spells={spells} hud={hud} input={props.input} cast={props.castSpell} save={props.saveSpell}
      />
    </HudLayer>
  );
}

function Vitals({ hud }: HudProps) {
  const hpFraction = useStore(hud, (s) => s.hpFraction);
  const staminaFraction = useStore(hud, (s) => s.staminaFraction);
  const combo = useStore(hud, (s) => s.comboMultiplier);
  return (
    <div className="absolute top-3 left-4">
      <PlayerBars hpFraction={hpFraction} staminaFraction={staminaFraction} />
      <div id="combo" className={`mt-1 font-title text-sm text-victory ${combo > 1 ? "opacity-100" : "opacity-0"}`}>
        Combo ×{combo.toFixed(2)}
      </div>
    </div>
  );
}

const CUE_WORDS: Record<Exclude<BattleCue, "none">, string> = { parried: "Parried!", staggered: "Staggered" };

/** A word over the fight while it holds: you parried it, or you're staggered. */
function Cue({ hud }: HudProps) {
  const cue = useStore(hud, (s) => s.cue);
  return (
    <div
      id="battle-cue"
      className={`absolute top-[28%] left-1/2 -translate-x-1/2 font-title text-3xl tracking-[3px] ${
        cue === "parried" ? "text-victory" : "text-died"
      } ${cue === "none" ? "opacity-0" : "opacity-100"} transition-opacity duration-150`}
    >
      {cue === "none" ? "" : CUE_WORDS[cue]}
    </div>
  );
}

function BossBar({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.enemyName);
  const hpFraction = useStore(hud, (s) => s.enemyHpFraction);
  const alive = useStore(hud, (s) => s.enemyAlive);
  return (
    <div
      className={`absolute bottom-12 left-1/2 w-[min(640px,70%)] -translate-x-1/2 transition-opacity duration-600 ${
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
  const leaveKey = useStore(bindings, (s) => s.battle.leave[0]!);
  const died = result === "lost";
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center ${RESULT_BAND} transition-opacity ${
        show ? "opacity-100" : "opacity-0"
      } duration-1200`}
    >
      <div className={`font-title text-6xl font-normal tracking-[6px] ${died ? "text-died" : "text-victory"}`}>
        {died ? "YOU DIED" : "PREY SLAUGHTERED"}
      </div>
      <div className="mt-2 font-normal opacity-80">Press {keyName(leaveKey)} to continue</div>
    </div>
  );
}
