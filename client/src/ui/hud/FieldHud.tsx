import type { FieldHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

export function FieldHud({ hud }: { hud: Store<FieldHudState> }) {
  const levelName = useStore(hud, (s) => s.levelName);
  const wins = useStore(hud, (s) => s.wins);
  return (
    <div id="field-hud" className="pointer-events-none fixed top-3 left-4 font-ui text-base/snug font-semibold text-white text-shadow-hud">
      {levelName} &nbsp;·&nbsp; boars defeated: {wins}
    </div>
  );
}
