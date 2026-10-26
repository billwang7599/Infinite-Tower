import { footprint, type Bag, type BagItem } from "@infinite-tower/shared";
import { CELL } from "./grid.js";
import { itemInfo } from "./itemInfo.js";

/** A stack's name, size, weight and what it does, just below it. On the bag's right half it hangs leftward. */
export function ItemTooltip({ stack, bag }: { stack: BagItem; bag: Bag }) {
  const info = itemInfo(stack);
  const { cols, rows } = footprint(stack.item, stack.turned);
  const side = stack.x + cols / 2 > bag.cols / 2
    ? { right: (bag.cols - stack.x - cols) * CELL }
    : { left: stack.x * CELL };
  return (
    <div
      id="bag-tooltip" role="tooltip" data-item={stack.item}
      className={
        "pointer-events-none absolute z-30 w-max max-w-60 rounded-sm border border-white/20 bg-night/95 px-3 py-2 "
        + "text-xs font-normal shadow-[0_8px_24px_#000a]"
      }
      style={{ top: (stack.y + rows) * CELL + 4, ...side }}
    >
      <div className="text-sm font-semibold">{info.name}</div>
      <div className="text-white/65 tabular-nums">Size {info.size}</div>
      <div className="text-white/65 tabular-nums">Weight {info.weight}</div>
      {info.effect && <div className="text-stamina">{info.effect}</div>}
    </div>
  );
}
