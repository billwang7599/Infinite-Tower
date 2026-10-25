/**
 * The field's inventory panel: what you carry, and a button to use what can be used. Like the character panel, it
 * doesn't block walking; the field HUD's bag button or the Inventory key (field.inventory) toggles it.
 */
import { ITEM_IDS, itemDef, type ItemId } from "@infinite-tower/shared";
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";
import type { FieldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";

interface PanelProps {
  hud: Store<FieldHudState>;
  use: (item: ItemId) => void;
  close: () => void;
}

export function InventoryPanel({ hud, use, close }: PanelProps) {
  const inventory = useStore(hud, (s) => s.inventory);
  // Healing items do nothing at full HP (the server refuses), so their button is off then.
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const carried = ITEM_IDS.filter((id) => (inventory[id] ?? 0) > 0);
  return (
    <PanelFrame id="inventory-panel" title="Inventory" close={close}>
      {carried.length === 0 && <p className="text-sm text-white/55">Nothing yet. Boars sometimes drop meat.</p>}
      <ul className="flex flex-col gap-3">
        {carried.map((id) => {
          const def = itemDef(id);
          return (
            <li key={id} data-item={id} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
              <span className="font-semibold">
                {def.name} <span className="text-victory tabular-nums">×{inventory[id]}</span>
              </span>
              {def.verb && (
                <button
                  type="button" {...NO_FOCUS} disabled={!!def.healHp && fullHp} onClick={() => use(id)}
                  className={`pointer-events-auto ${BUTTON.plain}`}
                >
                  {def.verb}
                </button>
              )}
              <span className="col-span-2 text-xs text-white/55">
                {def.description}{def.healHp ? ` Restores ${def.healHp} HP. Not mid-fight.` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
