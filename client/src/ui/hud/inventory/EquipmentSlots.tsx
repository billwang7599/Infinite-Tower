import { itemDef, type Gear, type Slot } from "@infinite-tower/shared";
import { drawItem } from "../../../gfx/items/items.js";
import { canDrop, landing, same, type BagMouse } from "./bagMouse.js";
import { ItemPicture } from "./BagGrid.js";
import { SCALE, SLOT_COLUMNS, SLOT_GAP_PX, SLOT_PX } from "./grid.js";

const LAYOUT: { slot: Slot; label: string }[] = [
  { slot: "rightHand", label: "Right hand" }, { slot: "head", label: "Head" }, { slot: "leftHand", label: "Left hand" },
  { slot: "body", label: "Body" }, { slot: "legs", label: "Legs" }, { slot: "boots", label: "Boots" },
];

interface SlotsProps {
  gear: Gear;
  mouse: BagMouse;
  area: (slot: Slot) => (el: HTMLDivElement | null) => void;
}

export function EquipmentSlots({ gear, mouse, area }: SlotsProps) {
  const spot = landing(mouse, gear);
  return (
    <div
      id="equipment" className="grid select-none"
      style={{ gridTemplateColumns: `repeat(${SLOT_COLUMNS}, ${SLOT_PX}px)`, gap: SLOT_GAP_PX }}
    >
      {LAYOUT.map(({ slot, label }) => {
        const here = { in: "slot", slot } as const;
        const item = gear.equipment[slot];
        const dragged = !!mouse.drag && same(mouse.drag.from, here);
        const landingHere = !!mouse.drag && same(spot, here);
        const state = landingHere ? `border-2 border-dashed ${canDrop(mouse, gear) ? "border-stamina" : "border-hp"}`
          : !mouse.drag && same(mouse.selected, here) ? "border-2 border-victory shadow-[0_0_10px_#e8c45a99]"
          : !mouse.drag && same(mouse.hover?.stack ?? null, here) ? "border border-white/30 bg-white/15"
          : "border border-white/15";
        const pic = item && drawItem(item);
        const scale = pic ? Math.min(SCALE, Math.floor(SLOT_PX / Math.max(pic.width, pic.height))) : 1;
        return (
          <div key={slot} className="flex flex-col items-center gap-1">
            <div
              ref={area(slot)} id={`slot-${slot}`} data-slot={slot} data-item={item ?? ""}
              aria-label={item ? `${label}: ${itemDef(item).name}` : `${label}: empty`}
              className={`relative bg-black/45 ${state}`} style={{ width: SLOT_PX, height: SLOT_PX }}
            >
              {item && (
                <div className={dragged ? "opacity-25" : ""}>
                  <ItemPicture item={item} turned={false} scale={scale} />
                </div>
              )}
            </div>
            <span className="text-[11px] text-white/45">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
