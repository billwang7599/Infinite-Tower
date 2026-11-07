import { itemDef, type Gear, type Slot } from "@infinite-tower/shared";
import type { ReactNode } from "react";
import { landing, same, type BagMouse } from "./bagMouse.js";
import { ItemPicture } from "./BagGrid.js";
import { SLOT_COLUMNS, SLOT_GAP_PX, SLOT_PX, SMALL_SLOT_GAP_PX, SMALL_SLOT_PX } from "./grid.js";

const HAND = (
  <>
    <path d="M18 11V6a2 2 0 0 0-4 0" />
    <path d="M14 10V4a2 2 0 0 0-4 0v2" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </>
);
const CAP = <><path d="M4 16a8 8 0 0 1 16 0z" /><path d="M3 16h18" /><circle cx="12" cy="6" r="1.5" /></>;
const HEAD = <><path d="M12 3a7 7 0 0 0-7 7v10h5v-5h4v5h5V10a7 7 0 0 0-7-7z" /><path d="M7 11h10M12 11v4" /></>;
const BODY = <path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z" />;
const LEGS = <><path d="M6 3h12l-1 18h-4l-1-11-1 11H7z" /><path d="M6.2 6h11.6" /></>;
const BOOTS = <><path d="M6 3h7v9l5.5 2.5A3 3 0 0 1 20 17.2V20H6z" /><path d="M6 6h7M6 17h14" /></>;
const RING = <><circle cx="12" cy="14" r="6" /><path d="m10 6 2-3 2 3" /></>;
const WRIST = <><ellipse cx="12" cy="12" rx="8" ry="4" /><ellipse cx="12" cy="12" rx="5" ry="2" /></>;

interface Shown { slot: Slot; label: string; outline: ReactNode; mirrored?: boolean }

const WORN: Shown[] = [
  { slot: "cap", label: "Cap", outline: CAP },
  { slot: "head", label: "Head", outline: HEAD },
  {
    slot: "back", label: "Back",
    outline: <><path d="M6 8a6 6 0 0 1 12 0v12H6z" /><path d="M9 4h6" /><path d="M9 14h6v6H9z" /></>,
  },
  { slot: "leftHand", label: "Left hand", outline: HAND },
  { slot: "body", label: "Body", outline: BODY },
  { slot: "rightHand", label: "Right hand", outline: HAND, mirrored: true },
  {
    slot: "belt", label: "Belt",
    outline: <><rect x="2" y="9" width="20" height="6" rx="1" /><rect x="7" y="7" width="6" height="10" rx="1" /></>,
  },
  { slot: "legs", label: "Legs", outline: LEGS },
  { slot: "boots", label: "Boots", outline: BOOTS },
];
const JEWELLERY: Shown[] = [
  { slot: "leftWrist", label: "L. wrist", outline: WRIST },
  { slot: "ring1", label: "Thumb", outline: RING },
  { slot: "ring2", label: "Index", outline: RING },
  { slot: "ring3", label: "Middle", outline: RING },
  { slot: "ring4", label: "Ring", outline: RING },
  { slot: "ring5", label: "Little", outline: RING },
  { slot: "rightWrist", label: "R. wrist", outline: WRIST },
];
const COSMETICS: Shown[] = [
  { slot: "capCosmetic", label: "Cap", outline: CAP },
  { slot: "headCosmetic", label: "Head", outline: HEAD },
  { slot: "bodyCosmetic", label: "Body", outline: BODY },
  { slot: "legsCosmetic", label: "Legs", outline: LEGS },
  { slot: "bootsCosmetic", label: "Boots", outline: BOOTS },
];

interface SlotsProps {
  gear: Gear;
  mouse: BagMouse;
  fits: boolean;
  area: (slot: Slot) => (el: HTMLDivElement | null) => void;
}

export function EquipmentSlots(props: SlotsProps) {
  const row = (shown: Shown[], px: number, gap: number, columns = shown.length) => (
    <div className="grid select-none" style={{ gridTemplateColumns: `repeat(${columns}, ${px}px)`, gap }}>
      {shown.map((s) => <SlotBox key={s.slot} {...props} shown={s} px={px} />)}
    </div>
  );
  return (
    <div id="equipment" className="flex flex-col gap-3">
      {row(WORN, SLOT_PX, SLOT_GAP_PX, SLOT_COLUMNS)}
      {row(JEWELLERY, SMALL_SLOT_PX, SMALL_SLOT_GAP_PX)}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-[11px] tracking-[0.2em] text-bone/50 uppercase">Cosmetics (looks only)</h4>
        {row(COSMETICS, SMALL_SLOT_PX, SMALL_SLOT_GAP_PX)}
      </div>
    </div>
  );
}

function SlotBox({ gear, mouse, fits, area, shown: { slot, label, outline, mirrored }, px }: SlotsProps & {
  shown: Shown;
  px: number;
}) {
  const here = { in: "slot", slot } as const;
  const item = gear.equipment[slot];
  const dragged = !!mouse.drag && same(mouse.drag.from, here);
  const landingHere = !!mouse.drag && same(landing(mouse, gear), here);
  const selected = !mouse.drag && same(mouse.selected, here);
  const hovered = !mouse.drag && same(mouse.hover?.stack ?? null, here);
  const state = landingHere ? `border-2 border-dashed bg-pit/65 ${fits ? "border-verdigris" : "border-error"}`
    : selected ? "bg-pit/65 inset-ring-2 inset-ring-cinnabar"
    : hovered ? "bg-bone/10 inset-ring inset-ring-bone/40"
    : `bg-pit/65 inset-shadow-[0_2px_6px_#000] inset-ring ${item ? "inset-ring-verdigris/60" : "inset-ring-bone/22"}`;
  const small = px < SLOT_PX;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={area(slot)} id={`slot-${slot}`} data-slot={slot} data-item={item ?? ""}
        aria-label={item ? `${label}: ${itemDef(item).name}` : `${label}: empty`}
        className={`relative cut-7 clip-cut ${state}`} style={{ width: px, height: px }}
      >
        {item ? (
          <div className={dragged ? "opacity-25" : ""}>
            <ItemPicture item={item} turned={false} maxPx={px} />
          </div>
        ) : (
          <svg
            viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round"
            className={
              `absolute inset-0 m-auto text-bone/15 ${small ? "size-6" : "size-11"} ${mirrored ? "-scale-x-100" : ""}`
            }
          >
            {outline}
          </svg>
        )}
      </div>
      <span className={`tracking-[0.04em] text-bone/50 ${small ? "text-[10px]" : "text-xs"}`}>
        {label}
      </span>
    </div>
  );
}
