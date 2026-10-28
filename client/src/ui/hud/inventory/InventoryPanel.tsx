/**
 * The bag screen: what's worn, the cloth (none in a fight) and the bag side by side, the weight against what you
 * can carry, and the selected item. Worked with the mouse (bagMouse.ts) and the bag keys. Moves go to the server (in
 * a fight, as the fight's inputs), which has the last word on all of it.
 */
import {
  carryLimit, gearBurden, gearWeight, itemDef, type BagItem, type Burden, type Cell, type Gear, type GearMove,
  type GridSpot, type Slot, type Spot, type Stats,
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
import { BagGrid, ItemTooltip, Placed } from "./BagGrid.js";
import {
  cancel, canDrop, doubleClick, hoveredStack, itemToUse, keepUp, NO_MOUSE, pointerDown, pointerMove, pointerUp,
  rightPress, selectedStack, tick, TOOLTIP_DELAY_MS, turnKey, type BagMouse, type Pointer,
} from "./bagMouse.js";
import { EquipmentSlots } from "./EquipmentSlots.js";
import { CELL, INVENTORY_GAP_PX } from "./grid.js";
import { formatWeight } from "./itemInfo.js";

interface PanelProps {
  gear: Gear;
  stats: Stats | null;
  /** Healing items can't be used: at full HP (the server refuses) or in a fight. */
  canHeal: boolean;
  input: Actions;
  settingsScreen: Store<SettingsScreenState>;
  use: (at: GridSpot) => void;
  move: (from: Spot, to: Spot, turned: boolean) => void;
  openSpellbook: () => void;
  close: () => void;
}

/** The mouse, and where in its grip cell the dragged item is held (pixels), so its ghost doesn't jump. */
interface View {
  mouse: BagMouse;
  grab: Cell;
}

const MIDDLE: Cell = { x: CELL / 2, y: CELL / 2 };
const START: View = { mouse: NO_MOUSE, grab: MIDDLE };

const MAIN = { button: 0, bit: 1 };
const SECONDARY = { button: 2, bit: 2 };

export function InventoryPanel(props: PanelProps) {
  const { gear, stats, canHeal, input, settingsScreen, use, move, openSpellbook, close } = props;
  const settingsOpen = useStore(settingsScreen, (s) => s.open);
  const [view, setView] = useState<View>(START);
  /** The same as `view`, for events that come before the next render (a pointer leaving right after a drop). */
  const latest = useRef<View>(START);
  const panel = useRef<HTMLDivElement>(null);
  const pressedAtPx = useRef<Cell>(MIDDLE);
  const areas = useRef(new Map<GridSpot["in"] | Slot, HTMLDivElement>());
  const area = (key: GridSpot["in"] | Slot) => (el: HTMLDivElement | null) => {
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
  const send = (m: GearMove | null) => { if (m) move(m.from, m.to, m.turned); };
  const bookInHand = (m: BagMouse) => !m.drag && m.selected?.in === "slot"
    && gear.equipment[m.selected.slot] === "spellbook";
  const applyUse = (m: BagMouse) => {
    const at = itemToUse(m, gear, !canHeal);
    if (at) use(at);
    else if (bookInHand(m)) openSpellbook();
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
      if (key !== "bag" && key !== "cloth") return { over: { in: "slot", slot: key }, x, y };
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
        {stats && (
          <p id="bag-weight" className="mb-3 text-xs text-white/55 tabular-nums">
            Weight {formatWeight(gearWeight(gear))} / {formatWeight(carryLimit(stats))}
            <BurdenNote burden={gearBurden(gear, stats)} />
          </p>
        )}
        <div className="flex items-start" style={{ gap: INVENTORY_GAP_PX }}>
          <Column title="Equipment">
            <EquipmentSlots gear={gear} mouse={mouse} area={area} />
          </Column>
          {gear.cloth.cols > 0 && (
            <Column title="Cloth" note="Left behind when you close the bag. Weighs nothing.">
              <BagGrid name="cloth" gear={gear} mouse={mouse} fits={fits} area={area("cloth")} />
            </Column>
          )}
          <Column title="Bag">
            <BagGrid name="bag" gear={gear} mouse={mouse} fits={fits} area={area("bag")} />
          </Column>
        </div>
        <BagDetails
          gear={gear} stack={selectedStack(mouse, gear)}
          usable={itemToUse(mouse, gear, !canHeal) !== null || bookInHand(mouse)}
          use={() => applyUse(current())}
        />
        {drag && dragged && pointer && (
          <Placed
            id="bag-ghost" data-fits={fits} stack={dragged} turned={drag.turned}
            left={pointer.x - drag.grip.x * CELL - view.grab.x} top={pointer.y - drag.grip.y * CELL - view.grab.y}
            className={`z-20 border-2 opacity-90 ${fits ? "border-stamina bg-stamina/20" : "border-hp bg-hp/25"}`}
          />
        )}
        {hovered && hover?.tooltip && pointer && (
          <ItemTooltip stack={hovered} at={pointer} panelWidth={panel.current?.clientWidth ?? width} />
        )}
      </div>
    </PanelFrame>
  );
}

function Column({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs tracking-[0.12em] text-white/55 uppercase">{title}</h3>
      {children}
      {note && <p className="max-w-48 text-[11px] text-white/40">{note}</p>}
    </section>
  );
}

/** What carrying too much does to you right now. */
function BurdenNote({ burden }: { burden: Burden }) {
  if (burden === "light") return null;
  return (
    <span id="bag-burden" data-burden={burden} className="block text-error">
      {burden === "heavy"
        ? "Heavy: dodging costs more stamina."
        : "Overloaded: no dodging, and you walk at half speed."}
    </span>
  );
}

interface DetailsProps {
  gear: Gear;
  /** The selected stack. */
  stack: BagItem | null;
  usable: boolean;
  use: () => void;
}

/** Under the grid: the selected item's name, count and description, and its use button. */
function BagDetails({ gear, stack, usable, use }: DetailsProps) {
  if (!stack) {
    return (
      <p id="bag-details" className="mt-3 min-h-16 text-sm text-white/55">
        {gear.bag.items.length === 0 ? "Nothing in the bag yet. Boars sometimes drop things." : ""}
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
