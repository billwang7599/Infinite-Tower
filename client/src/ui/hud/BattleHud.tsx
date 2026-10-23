import type { KeyBindings } from "../../settings/bindings.js";
import { Bar } from "../components/Bar.js";
import { PlayerBars } from "../components/PlayerBars.js";
import { keyName } from "../keyNames.js";
import type { BattleHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

type HudProps = { hud: Store<BattleHudState> };

export function BattleHud({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
  return (
    <div id="battle-hud" className="pointer-events-none fixed inset-0 font-ui text-base/snug font-semibold text-white text-shadow-hud">
      <Vitals hud={hud} />
      <BossBar hud={hud} />
      <ResultBanner hud={hud} bindings={bindings} />
      <CameraStatus hud={hud} bindings={bindings} />
    </div>
  );
}

function Vitals({ hud }: HudProps) {
  const hp = useStore(hud, (s) => s.hp);
  const stamina = useStore(hud, (s) => s.stamina);
  return (
    <div className="absolute top-3 left-4">
      <PlayerBars hp={hp} stamina={stamina} />
    </div>
  );
}

function BossBar({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.enemyName);
  const hp = useStore(hud, (s) => s.enemyHp);
  const alive = useStore(hud, (s) => s.enemyAlive);
  return (
    <div className={`absolute bottom-12 left-1/2 w-[min(640px,70vw)] -translate-x-1/2 transition-opacity duration-600 ${alive ? "opacity-100" : "opacity-0"}`}>
      <div id="boss-name" className="mb-1 font-title text-[17px] font-medium tracking-wide">{name}</div>
      <Bar value={hp} fill="from-boss to-boss-dark" chip />
    </div>
  );
}

function ResultBanner({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
  const result = useStore(hud, (s) => s.result);
  const show = useStore(hud, (s) => s.showResult);
  const leaveKey = useStore(bindings, (s) => s.battle.leave[0]!);
  const died = result === "lost";
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(transparent_38%,#000b_45%,#000b_58%,transparent_65%)] transition-opacity duration-1200 ${show ? "opacity-100" : "opacity-0"}`}>
      <div className={`font-title text-6xl font-normal tracking-[6px] ${died ? "text-died" : "text-victory"}`}>
        {died ? "YOU DIED" : "PREY SLAUGHTERED"}
      </div>
      <div className="mt-2 font-normal opacity-80">Press {keyName(leaveKey)} to continue</div>
    </div>
  );
}

function CameraStatus({ hud, bindings }: HudProps & { bindings: KeyBindings }) {
  const lockOn = useStore(hud, (s) => s.lockOn);
  const mouseCaptured = useStore(hud, (s) => s.mouseCaptured);
  const lockKey = keyName(useStore(bindings, (s) => s.battle.lockOn[0]!));
  return (
    <div id="lock" className="absolute top-3 right-4 text-right text-[13px] font-normal">
      {lockOn ? <><span className="text-victory">◎ Locked on</span> ({lockKey} to free the camera)</> : `Free camera (${lockKey} to lock on)`}
      {!mouseCaptured && <><br /><span className="opacity-60">Click to use the mouse / trackpad</span></>}
    </div>
  );
}
