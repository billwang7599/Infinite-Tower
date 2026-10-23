import type { FieldHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

/** The field HUD: level name, fights won, and the controls hint. */
export function FieldHud({ hud }: { hud: Store<FieldHudState> }) {
  const levelName = useStore(hud, (s) => s.levelName);
  const wins = useStore(hud, (s) => s.wins);
  return (
    <div id="field-hud" className="pointer-events-none fixed top-3 left-4 font-ui text-base/snug font-semibold text-white text-shadow-hud">
      {levelName} &nbsp;·&nbsp; boars defeated: {wins}
      <br />
      <small className="text-[13px] font-normal opacity-80">WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>
    </div>
  );
}
