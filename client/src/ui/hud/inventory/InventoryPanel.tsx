/**
 * The field's inventory panel: what's in your bag, how much it weighs against what you can carry, and a button to
 * use what can be used. Like the character panel, it doesn't block walking; the field HUD's bag button or the
 * Inventory key (field.inventory) toggles it.
 */
import { bagWeight, carryLimit, itemDef, type Cell } from "@infinite-tower/shared";
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";
import type { FieldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";

interface PanelProps {
  hud: Store<FieldHudState>;
  use: (at: Cell) => void;
  close: () => void;
}

export function InventoryPanel({ hud, use, close }: PanelProps) {
  const bag = useStore(hud, (s) => s.bag);
  const stats = useStore(hud, (s) => s.stats);
  // Healing items do nothing at full HP (the server refuses), so their button is off then.
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  return (
    <PanelFrame id="inventory-panel" title="Inventory" close={close}>
      {stats && (
        <p id="bag-weight" className="mb-3 text-xs text-white/55 tabular-nums">
          Weight {formatWeight(bagWeight(bag))} / {formatWeight(carryLimit(stats))}
        </p>
      )}
      {bag.items.length === 0 && <p className="text-sm text-white/55">Nothing yet. Boars sometimes drop things.</p>}
      <ul className="flex flex-col gap-3">
        {bag.items.map((stack) => {
          const def = itemDef(stack.item);
          return (
            <li
              key={`${stack.x},${stack.y}`} data-item={stack.item}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3"
            >
              <span className="font-semibold">
                {def.name} <span className="text-victory tabular-nums">×{stack.count}</span>
              </span>
              {def.verb && (
                <button
                  type="button" {...NO_FOCUS} disabled={!!def.healHp && fullHp} onClick={() => use({ x: stack.x, y: stack.y })}
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

/** One decimal place at most: "12", "12.5". */
const formatWeight = (weight: number) => String(Math.round(weight * 10) / 10);
