import { itemDef, type Gear, type Slot } from "@infinite-tower/shared";
import type { ReactNode } from "react";
import { canDrop, landing, same, type BagMouse } from "./bagMouse.js";
import { ItemPicture } from "./BagGrid.js";
import { SLOT_COLUMNS, SLOT_GAP_PX, SLOT_PX } from "./grid.js";

const HAND = (
  <>
    <path d="M18 11V6a2 2 0 0 0-4 0" />
    <path d="M14 10V4a2 2 0 0 0-4 0v2" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </>
);

const LAYOUT: { slot: Slot; label: string; outline: ReactNode; mirrored?: boolean }[] = [
  { slot: "leftHand", label: "Left hand", outline: HAND },
  {
    slot: "head", label: "Head",
    outline: <><path d="M12 3a7 7 0 0 0-7 7v10h5v-5h4v5h5V10a7 7 0 0 0-7-7z" /><path d="M7 11h10M12 11v4" /></>,
  },
  { slot: "rightHand", label: "Right hand", outline: HAND, mirrored: true },
  {
    slot: "body", label: "Body",
    outline: <path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z" />,
  },
  {
    slot: "legs", label: "Legs",
    outline: <><path d="M6 3h12l-1 18h-4l-1-11-1 11H7z" /><path d="M6.2 6h11.6" /></>,
  },
  {
    slot: "boots", label: "Boots",
    outline: <><path d="M6 3h7v9l5.5 2.5A3 3 0 0 1 20 17.2V20H6z" /><path d="M6 6h7M6 17h14" /></>,
  },
];

interface SlotsProps {
  gear: Gear;
  mouse: BagMouse;
  area: (slot: Slot) => (el: HTMLDivElement | null) => void;
}

export function EquipmentSlots({ gear, mouse, area }: SlotsProps) {
  const spot = landing(mouse, gear);
  const edge = canDrop(mouse, gear) ? "border-stamina" : "border-hp";
  return (
    <div
      id="equipment" className="grid select-none"
      style={{ gridTemplateColumns: `repeat(${SLOT_COLUMNS}, ${SLOT_PX}px)`, gap: SLOT_GAP_PX }}
    >
      {LAYOUT.map(({ slot, label, outline, mirrored }) => {
        const here = { in: "slot", slot } as const;
        const item = gear.equipment[slot];
        const dragged = !!mouse.drag && same(mouse.drag.from, here);
        const landingHere = !!mouse.drag && same(spot, here);
        const selected = !mouse.drag && same(mouse.selected, here);
        const hovered = !mouse.drag && same(mouse.hover?.stack ?? null, here);
        const state = landingHere ? `border-2 border-dashed bg-black/60 ${edge}`
          : selected ? "border-2 border-victory bg-black/60 shadow-[0_0_10px_#e8c45a99]"
          : hovered ? "border border-white/35 bg-white/10"
          : `border bg-black/60 shadow-[inset_0_2px_10px_#000] ${item ? "border-victory/30" : "border-white/15"}`;
        return (
          <div key={slot} className="flex flex-col items-center gap-1.5">
            <div
              ref={area(slot)} id={`slot-${slot}`} data-slot={slot} data-item={item ?? ""}
              aria-label={item ? `${label}: ${itemDef(item).name}` : `${label}: empty`}
              className={`relative rounded-sm ${state}`} style={{ width: SLOT_PX, height: SLOT_PX }}
            >
              {item ? (
                <div className={dragged ? "opacity-25" : ""}>
                  <ItemPicture item={item} turned={false} maxPx={SLOT_PX} />
                </div>
              ) : (
                <svg
                  viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`absolute inset-0 m-auto size-11 text-white/15 ${mirrored ? "-scale-x-100" : ""}`}
                >
                  {outline}
                </svg>
              )}
            </div>
            <span className="font-title text-xs tracking-[0.06em] text-white/50">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
