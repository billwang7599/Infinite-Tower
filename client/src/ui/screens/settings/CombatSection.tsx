import { COMBAT_STYLE_IDS, COMBAT_STYLES, isCombatStyle } from "@infinite-tower/shared";
import type { CombatSettings } from "../../../settings/combat.js";
import { useStore } from "../../useStore.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

export function CombatSection({ combat }: { combat: CombatSettings }) {
  const style = useStore(combat, (s) => s.style);
  return (
    <section id="combat-settings" className="mt-6">
      <h3 className={SECTION_TITLE}>Combat</h3>
      <div className={`mt-2 ${SETTING_ROW}`}>
        <label htmlFor="combat-style" className="flex flex-col">
          <span className={SETTING_LABEL}>Combat style</span>
          <span className="text-xs text-white/45">
            How the fights you start play (a duel: the challenger's), from the next one
          </span>
        </label>
        <select
          id="combat-style"
          value={style}
          onChange={(e) => {
            const picked = e.currentTarget.value;
            if (isCombatStyle(picked)) combat.setStyle(picked);
          }}
          className={`cursor-pointer rounded-sm border border-white/20 bg-night px-2 py-1 text-sm ${FOCUS_RING}`}
        >
          {COMBAT_STYLE_IDS.map((id) => <option key={id} value={id}>{COMBAT_STYLES[id].name}</option>)}
        </select>
      </div>
    </section>
  );
}
