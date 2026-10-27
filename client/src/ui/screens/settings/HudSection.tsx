import type { HudSettings } from "../../../settings/hud.js";
import { useStore } from "../../useStore.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

export function HudSection({ hud }: { hud: HudSettings }) {
  const showPing = useStore(hud, (s) => s.showPing);
  return (
    <section id="hud-settings" className="mt-6">
      <h3 className={SECTION_TITLE}>HUD</h3>
      <div className={`mt-2 ${SETTING_ROW}`}>
        <label htmlFor="show-ping" className="flex flex-col">
          <span className={SETTING_LABEL}>Show ping</span>
          <span className="text-xs text-white/45">The round trip to the server, in the top-right corner</span>
        </label>
        <input
          id="show-ping"
          type="checkbox"
          checked={showPing}
          onChange={(e) => hud.setShowPing(e.currentTarget.checked)}
          className={`size-4 cursor-pointer accent-victory ${FOCUS_RING}`}
        />
      </div>
    </section>
  );
}
