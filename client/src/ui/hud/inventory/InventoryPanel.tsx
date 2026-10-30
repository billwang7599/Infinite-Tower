/**
 * The bag screen: what's worn, an open pile above the cloth (neither in a fight) and the bag side by side, the weight
 * against what you can carry, and the selected item. Worked with the mouse (bagMouse.ts) and the bag keys. Moves go
 * to the server (in a fight, as the fight's inputs), which has the last word on all of it.
 */
import {
  carryLimit, gearBurden, gearWeight, itemDef, SLOTS, type BagItem, type Burden, type Cell, type Gear, type GearMove,
  type GridName, type GridSpot, type Slot, type Spot, type Stats, type UseSpot,
} from "@infinite-tower/shared";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Actions } from "../../../core/actions.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";
import { useAction } from "../../components/useAction.js";
import type { SettingsScreenState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { inventoryPanelWidthPx } from "../layout.js";
import { PanelFrame } from "../PanelFrame.js";
import { BagGrid, ItemPicture, ItemTooltip, Placed } from "./BagGrid.js";
import {
  cancel, canDrop, doubleClick, hoveredStack, itemToUse, keepUp, NO_MOUSE, pointerDown, pointerMove, pointerUp,
  rightPress, selectedStack, tick, TOOLTIP_DELAY_MS, turnKey, type BagMouse, type Pointer,
} from "./bagMouse.js";
import { EquipmentSlots } from "./EquipmentSlots.js";
import { CELL, INVENTORY_GAP_PX } from "./grid.js";
import { effectsText, formatWeight, itemInfo } from "./itemInfo.js";

interface PanelProps {
  gear: Gear;
  stats: Stats | null;
  canHeal: boolean;
  using: UseSpot | null;
  input: Actions;
  settingsScreen: Store<SettingsScreenState>;
  use: (at: UseSpot) => void;
  move: (from: Spot, to: Spot, turned: boolean) => void;
  openSkillbook: () => void;
  close: () => void;
}

/** The mouse, and where in its grip cell the dragged item is held (pixels), so its ghost doesn't jump. */
interface View {
  mouse: BagMouse;
  grab: Cell;
}

const MIDDLE: Cell = { x: CELL / 2, y: CELL / 2 };
const START: View = { mouse: NO_MOUSE, grab: MIDDLE };

const isSlot = (key: GridName | Slot): key is Slot => (SLOTS as readonly string[]).includes(key);

const MAIN = { button: 0, bit: 1 };
const SECONDARY = { button: 2, bit: 2 };

export function InventoryPanel(props: PanelProps) {
  const { gear, stats, canHeal, using, input, settingsScreen, use, move, openSkillbook, close } = props;
  const settingsOpen = useStore(settingsScreen, (s) => s.open);
  const [view, setView] = useState<View>(START);
  /** The same as `view`, for events that come before the next render (a pointer leaving right after a drop). */
  const latest = useRef<View>(START);
  const panel = useRef<HTMLDivElement>(null);
  const pressedAtPx = useRef<Cell>(MIDDLE);
  const areas = useRef(new Map<GridName | Slot, HTMLDivElement>());
  const area = (key: GridName | Slot) => (el: HTMLDivElement | null) => {
    if (el) areas.current.set(key, el);
    else areas.current.delete(key);
  };
  // The gear can change under the mouse (the server's answer, a meal eaten), so keep up with it every render.
  const mouse = keepUp(view.mouse, gear);

  const current = () => keepUp(latest.current.mouse, gear);
  /** The mouse is now `next`; the ghost's hold is taken as a drag starts and turned with it. */
  const set = (next: BagMouse) => {
    const before = latest.current.mouse;
    let { grab } = latest.current;
    if (!before.drag && next.drag) {
      grab = next.drag.from.in === "slot" ? MIDDLE : pressedAtPx.current;
    } else if (before.drag && next.drag && before.drag.turned !== next.drag.turned) {
      grab = { x: grab.y, y: grab.x };
    }
    latest.current = { mouse: next, grab };
    setView(latest.current);
  };
  const send = (m: GearMove | null) => { if (m && !using) move(m.from, m.to, m.turned); };
  const bookInHand = (m: BagMouse) => !m.drag && m.selected?.in === "slot"
    && gear.equipment[m.selected.slot] === "skillbook";
  const applyUse = (m: BagMouse) => {
    const at = itemToUse(m, gear, !canHeal);
    if (at && !using) use(at);
    else if (!at && bookInHand(m)) openSkillbook();
  };
  const turnWith = (turn: typeof turnKey) => {
    const { mouse: next, move: turned } = turn(current(), gear);
    set(next);
    send(turned);
  };

  const locate = (e: MouseEvent): Pointer => {
    const box = panel.current!.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    for (const [key, el] of areas.current) {
      const r = el.getBoundingClientRect();
      const ix = e.clientX - r.left, iy = e.clientY - r.top;
      if (ix < 0 || iy < 0 || ix >= r.width || iy >= r.height) continue;
      pressedAtPx.current = { x: ix % CELL, y: iy % CELL };
      if (isSlot(key)) return { over: { in: "slot", slot: key }, x, y };
      return { over: { in: key, x: Math.floor(ix / CELL), y: Math.floor(iy / CELL) }, x, y };
    }
    return { over: null, x, y };
  };

  // Settings over the bag: a drag in progress goes back.
  useEffect(() => { if (settingsOpen) set(cancel(latest.current.mouse)); }, [settingsOpen]);

  // The tooltip shows once the pointer has rested on an item long enough.
  const { hover } = mouse;
  useEffect(() => {
    if (!hover || hover.tooltip) return;
    const waitMs = hover.sinceMs + TOOLTIP_DELAY_MS - performance.now();
    const timer = setTimeout(() => set(tick(latest.current.mouse, performance.now())), Math.max(0, waitMs) + 5);
    return () => clearTimeout(timer);
  }, [hover]);

  useAction(input, ["turnItem", "useItem", "closeBag"], (action, repeat) => {
    if (repeat) return false;
    if (action === "turnItem") turnWith(turnKey);
    else if (action === "useItem") applyUse(current());
    else close();
  });

  const up = (p: Pointer) => {
    const { mouse: next, move: moved } = pointerUp(current(), gear, p, performance.now());
    set(next);
    send(moved);
  };
  const fits = canDrop(mouse, gear);
  const { drag, pointer } = mouse;
  const dragged = drag && (drag.from.in === "slot"
    ? { item: drag.item, count: 1, x: 0, y: 0, turned: false }
    : gear[drag.from.in].items.find((s) => s.x === (drag.from as GridSpot).x && s.y === (drag.from as GridSpot).y));
  const hovered = hoveredStack(mouse, gear);
  const width = inventoryPanelWidthPx(gear);

  return (
    <PanelFrame id="inventory-panel" title="Inventory" close={close} width={width}>
      <div
        ref={panel} className="pointer-events-auto relative touch-none select-none"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.target instanceof Element && e.target.closest("button")) return;
          if (e.button === SECONDARY.button) turnWith(rightPress);
          if (e.button !== MAIN.button) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          set(pointerDown(current(), gear, locate(e)));
        }}
        onPointerMove={(e) => {
          // A button pressed or let go while another is held comes as a move, not a down or an up (chorded buttons).
          if (e.button === SECONDARY.button && e.buttons & SECONDARY.bit) turnWith(rightPress);
          if (e.button === MAIN.button && !(e.buttons & MAIN.bit)) up(locate(e));
          else set(pointerMove(current(), gear, locate(e), performance.now()));
        }}
        onPointerUp={(e) => { if (e.button === MAIN.button) up(locate(e)); }}
        onPointerLeave={() => set(pointerMove(current(), gear, null, performance.now()))}
        onPointerCancel={() => set(cancel(current()))}
        onDoubleClick={(e) => {
          const next = doubleClick(current(), gear, locate(e));
          set(next);
          applyUse(next);
        }}
      >
        <div className="flex items-start" style={{ gap: INVENTORY_GAP_PX }}>
          <Column title="Equipment">
            <EquipmentSlots gear={gear} mouse={mouse} area={area} />
          </Column>
          {(gear.pile.cols > 0 || gear.cloth.cols > 0) && (
            <div className="flex flex-col" style={{ gap: INVENTORY_GAP_PX }}>
              {gear.pile.cols > 0 && (
                <Column title="Pile">
                  <BagGrid name="pile" gear={gear} mouse={mouse} fits={fits} area={area("pile")} />
                  <p className="max-w-48 text-[11px] text-white/40 italic">Anyone nearby can take from it too.</p>
                </Column>
              )}
              {gear.cloth.cols > 0 && (
                <Column title="Cloth">
                  <BagGrid name="cloth" gear={gear} mouse={mouse} fits={fits} area={area("cloth")} />
                  <p className="max-w-48 text-[11px] text-white/40 italic">
                    Left behind when you close the bag. Weighs nothing.
                  </p>
                </Column>
              )}
            </div>
          )}
          <Column title="Bag">
            <BagGrid name="bag" gear={gear} mouse={mouse} fits={fits} area={area("bag")} />
            {stats && <Weight gear={gear} stats={stats} />}
          </Column>
        </div>
        <BagDetails
          gear={gear} stack={selectedStack(mouse, gear)} using={using !== null}
          usable={(!using && itemToUse(mouse, gear, !canHeal) !== null) || bookInHand(mouse)}
          use={() => applyUse(current())}
        />
        {drag && dragged && pointer && (
          <Placed
            id="bag-ghost" data-fits={fits} stack={dragged} turned={drag.turned}
            left={pointer.x - drag.grip.x * CELL - view.grab.x} top={pointer.y - drag.grip.y * CELL - view.grab.y}
            className={`z-20 rounded-[2px] border-2 opacity-90 ${fits ? "border-stamina bg-stamina/20" : "border-hp bg-hp/25"}`}
          />
        )}
        {hovered && hover?.tooltip && pointer && (
          <ItemTooltip stack={hovered} at={pointer} panelWidth={panel.current?.clientWidth ?? width} />
        )}
      </div>
    </PanelFrame>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 font-title text-[13px] tracking-[0.14em] text-victory/80 uppercase">
        {title}
        <span className="h-px flex-1 bg-linear-to-r from-victory/30 to-transparent" />
      </h3>
      {children}
    </section>
  );
}

const BURDEN_LOOK: Record<Burden, { fill: string; text: string }> = {
  light: { fill: "bg-white/40", text: "text-white" },
  heavy: { fill: "bg-ping-fair", text: "text-ping-fair" },
  overloaded: { fill: "bg-hp", text: "text-error" },
};

function Weight({ gear, stats }: { gear: Gear; stats: Stats }) {
  const weight = gearWeight(gear), limit = carryLimit(stats);
  const burden = gearBurden(gear, stats);
  const look = BURDEN_LOOK[burden];
  const filledPercent = Math.min(100, (weight / limit) * 100);
  return (
    <div id="bag-weight" data-burden={burden} className="mt-0.5 text-xs">
      <div className="flex items-baseline justify-between">
        <span className="tracking-[0.12em] text-white/50 uppercase">Weight</span>
        <span className="tabular-nums">
          <span className={`font-semibold ${look.text}`}>{formatWeight(weight)}</span>
          <span className="text-white/45"> / {formatWeight(limit)}</span>
        </span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full border border-white/15 bg-black/60">
        <div className={`absolute inset-y-0 left-0 ${look.fill}`} style={{ width: `${filledPercent}%` }} />
      </div>
      {burden !== "light" && (
        <span id="bag-burden" data-burden={burden} className={`mt-1 block ${look.text}`}>
          {burden === "heavy"
            ? "Heavy: dodging costs more stamina."
            : "Overloaded: no dodging, and you walk at half speed."}
        </span>
      )}
    </div>
  );
}

interface DetailsProps {
  gear: Gear;
  /** The selected stack. */
  stack: BagItem | null;
  usable: boolean;
  using: boolean;
  use: () => void;
}

/** Under the grid: the selected item's name, count and description, and its use button. */
function BagDetails({ gear, stack, usable, using, use }: DetailsProps) {
  if (!stack) {
    return (
      <p id="bag-details" className={`${DETAILS_STRIP} text-sm text-white/45 italic`}>
        {gear.bag.items.length === 0 ? "Nothing in the bag yet. Boars sometimes drop things." : ""}
      </p>
    );
  }
  const def = itemDef(stack.item), verb = def.consumable?.verb ?? def.wearable?.verb;
  return (
    <div id="bag-details" data-item={stack.item} className={`${DETAILS_STRIP} flex items-start gap-4`}>
      <div
        className="relative shrink-0 rounded-sm border border-white/15 bg-black/60 shadow-[inset_0_2px_10px_#000]"
        style={{ width: DETAILS_PICTURE_PX, height: DETAILS_PICTURE_PX }}
      >
        <ItemPicture item={stack.item} turned={false} maxPx={DETAILS_PICTURE_PX - 8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-title text-base tracking-[0.04em] text-victory">
          {def.name} {stack.count > 1 && <span className="text-white tabular-nums">×{stack.count}</span>}
        </div>
        <p className="mt-0.5 text-xs text-white/60">
          {def.description}{def.consumable ? ` ${effectsText(def.consumable.effects)}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-white/40 tabular-nums">Weight {itemInfo(stack).weight}</p>
      </div>
      {verb && (
        <button
          type="button" id="bag-use" {...NO_FOCUS} disabled={!usable} onClick={use}
          className={`pointer-events-auto self-center ${BUTTON.primary}`}
        >
          {using && def.consumable ? `${verb}ing…` : verb}
        </button>
      )}
    </div>
  );
}

const DETAILS_STRIP = "mt-4 min-h-[88px] border-t border-white/10 pt-3";
const DETAILS_PICTURE_PX = 72;
