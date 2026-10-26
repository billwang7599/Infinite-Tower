import { itemDef, type Bag, type BagItem } from "@infinite-tower/shared";
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";

interface DetailsProps {
  bag: Bag;
  /** The selected stack. */
  stack: BagItem | null;
  usable: boolean;
  use: () => void;
}

/** Under the grid: the selected item's name, count and description, and its use button. */
export function BagDetails({ bag, stack, usable, use }: DetailsProps) {
  if (!stack) {
    return (
      <p id="bag-details" className="mt-3 min-h-16 text-sm text-white/55">
        {bag.items.length === 0 ? "Nothing yet. Boars sometimes drop things." : ""}
      </p>
    );
  }
  const def = itemDef(stack.item);
  return (
    <div
      id="bag-details" data-item={stack.item} className="mt-3 grid min-h-16 grid-cols-[1fr_auto] items-start gap-x-3"
    >
      <span className="font-semibold">
        {def.name} {stack.count > 1 && <span className="text-victory tabular-nums">×{stack.count}</span>}
      </span>
      {def.verb && (
        <button
          type="button" id="bag-use" {...NO_FOCUS} disabled={!usable} onClick={use}
          className={`pointer-events-auto ${BUTTON.plain}`}
        >
          {def.verb}
        </button>
      )}
      <span className="col-span-2 text-xs text-white/55">
        {def.description}{def.healHp ? ` Restores ${def.healHp} HP. Not mid-fight.` : ""}
      </span>
    </div>
  );
}
