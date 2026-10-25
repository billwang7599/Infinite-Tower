import type { KeyBindings } from "../../settings/bindings.js";
import { Bar } from "../components/Bar.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { keyName } from "../keyNames.js";
import type { BattleHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { HudLayer } from "./HudLayer.js";

type HudProps = { hud: Store<BattleHudState> };

/** The dark band behind the result, fading out above and below. */
const RESULT_BAND = "bg-[linear-gradient(transparent_38%,#000b_45%,#000b_58%,transparent_65%)]";

export function BattleHud({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
  return (
    <HudLayer id="battle-hud">
      <Vitals hud={hud} />
      <BossBar hud={hud} />
      <ResultBanner hud={hud} bindings={bindings} />
      <MouseHint hud={hud} />
    </HudLayer>
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

function MouseHint({ hud }: HudProps) {
  const mouseCaptured = useStore(hud, (s) => s.mouseCaptured);
  if (mouseCaptured) return null;
  return (
    <div id="mouse-hint" className="absolute top-3 right-4 text-right text-[13px] font-normal opacity-60">
      Click to use the mouse / trackpad
    </div>
  );
}
