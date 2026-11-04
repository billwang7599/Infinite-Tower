/**
 * The bag screen: what's worn, an open pile above the cloth (neither in a fight), and the bag and the backpack side by
 * side, the weight against what you can carry, and the selected item. Worked with the mouse (bagMouse.ts) and the bag
 * keys. Moves go to the server (in a fight, as the fight's inputs), which has the last word on all of it.
 */
import {
  carryLimit, formatPrice, gearBurden, gearWeight, itemDef, SLOTS, type BagItem, type Burden, type CarvePrice,
  type Cell, type CoreState, type Gear, type GearMove, type GridName, type GridSpot, type ShopView, type Slot,
  type Spot, type Stats, type UseSpot, type WeaponId,
} from "@infinite-tower/shared";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { NO_FOCUS } from "../../components/noFocus.js";
import { Bar } from "../../components/Bar.js";
import { BUTTON, LABEL, WELL } from "../../components/styles.js";
import { useAction } from "../../components/useAction.js";
import { useGame } from "../../context.js";
import { say } from "../../notifications/say.js";
import type { GameRequests } from "../../state.js";
import { useStore } from "../../useStore.js";
import { INSCRIPTION_TEXT } from "../inscriptions.js";
import { stacksGrids, useStageSize } from "../layout.js";
import { PanelFrame } from "../PanelFrame.js";
import { BagGrid, ItemPicture, ItemTooltip, Placed } from "./BagGrid.js";
import {
  cancel, canDrop, doubleClick, hoveredStack, itemToUse, keepUp, NO_MOUSE, pointerDown, pointerMove, pointerUp,
  rightPress, selectedStack, tick, TOOLTIP_DELAY_MS, turnKey, type BagMouse, type Pointer,
} from "./bagMouse.js";
import { EquipmentSlots } from "./EquipmentSlots.js";
import { ShopColumn } from "./ShopColumn.js";
import { CELL, INVENTORY_GAP_PX } from "./grid.js";
import { effectsText, formatWeight, itemInfo, RARITY_TEXT } from "./itemInfo.js";

interface PanelProps {
  gear: Gear;
  stats: Stats | null;
  canHeal: boolean;
  using: UseSpot | null;
  close: () => void;
  trade?: Trading | null;
  shownWidth?: (px: number) => void;
}

interface Trading {
  shop: ShopView;
  core: CoreState;
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
  const { gear, stats, canHeal, using, close, trade } = props;
  const { ui, input, actions } = useGame();
  const { useItem: use, moveItem: move, request } = actions;
  const openSkillbook = () => ui.skillbookScreen.set({ open: true });
  const tooWeak = (item: WeaponId) => say(ui.notifications, { kind: "tooWeak", item });
  const stacked = stacksGrids(useStageSize());
  const strength = stats?.strength ?? 0;
  const settingsOpen = useStore(ui.settingsScreen, (s) => s.open);
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
    // The frame may be scaled down to fit the view; everything inside works in its unscaled pixels.
    const scale = box.width / panel.current!.offsetWidth;
    const x = (e.clientX - box.left) / scale, y = (e.clientY - box.top) / scale;
    for (const [key, el] of areas.current) {
      const r = el.getBoundingClientRect();
      const ix = (e.clientX - r.left) / scale, iy = (e.clientY - r.top) / scale;
      if (ix < 0 || iy < 0 || ix >= el.offsetWidth || iy >= el.offsetHeight) continue;
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
    const { mouse: next, move: moved, tooWeak: refused } = pointerUp(current(), gear, p, performance.now(), strength);
    set(next);
    send(moved);
    if (refused) tooWeak(refused);
  };
  const fits = canDrop(mouse, gear, strength);
  const { drag, pointer } = mouse;
  const dragged = drag && (drag.from.in === "slot"
    ? { item: drag.item, count: 1, x: 0, y: 0, turned: false }
    : gear[drag.from.in].items.find((s) => s.x === (drag.from as GridSpot).x && s.y === (drag.from as GridSpot).y));
  const hovered = hoveredStack(mouse, gear);
  const side = trade ? (
    <Column title="Trade">
      <ShopColumn shop={trade.shop} gear={gear} core={trade.core} />
    </Column>
  ) : (
    <Column title="Equipment">
      <EquipmentSlots gear={gear} mouse={mouse} fits={fits} area={area} />
    </Column>
  );
  const pile = gear.pile.cols > 0 && (
    <Column title="Pile">
      <BagGrid name="pile" gear={gear} mouse={mouse} fits={fits} area={area("pile")} />
      <p className="max-w-48 text-[11px] text-bone/40 italic">Anyone nearby can take from it too.</p>
    </Column>
  );
  const cloth = gear.cloth.cols > 0 && (
    <Column title="Cloth">
      <BagGrid name="cloth" gear={gear} mouse={mouse} fits={fits} area={area("cloth")} />
      <p className="max-w-48 text-[11px] text-bone/40 italic">Left behind when you close the bag. Weighs nothing.</p>
    </Column>
  );
  const bag = (
    <div className="flex flex-col gap-2">
      <Row>
        <Column title="Bag">
          <BagGrid name="bag" gear={gear} mouse={mouse} fits={fits} area={area("bag")} />
        </Column>
        <Column title="Backpack">
          {gear.pack.cols > 0 ? <BagGrid name="pack" gear={gear} mouse={mouse} fits={fits} area={area("pack")} /> : (
            <p id="no-backpack" className="max-w-32 text-[11px] text-bone/40 italic">
              None on. Wear one on your back for more room.
            </p>
          )}
        </Column>
      </Row>
      {stats && <Weight gear={gear} stats={stats} />}
    </div>
  );

  return (
    <PanelFrame
      id="inventory-panel" title={trade ? trade.shop.name : "Inventory"} close={close} shownWidth={props.shownWidth}
    >
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
        {stacked ? (
          <div className="flex flex-col" style={{ gap: INVENTORY_GAP_PX }}>
            <Row>{side}{bag}</Row>
            {(pile || cloth) && <Row>{pile}{cloth}</Row>}
          </div>
        ) : (
          <Row>
            {side}
            {(pile || cloth) && <div className="flex flex-col" style={{ gap: INVENTORY_GAP_PX }}>{pile}{cloth}</div>}
            {bag}
          </Row>
        )}
        <BagDetails
          gear={gear} stack={selectedStack(mouse, gear)} using={using !== null}
          usable={(!using && itemToUse(mouse, gear, !canHeal) !== null) || bookInHand(mouse)}
          use={() => applyUse(current())} sale={trade ? saleOf(mouse.selected, trade, request) : null}
        />
        {drag && dragged && pointer && (
          <Placed
            id="bag-ghost" data-fits={fits} stack={dragged} turned={drag.turned}
            left={pointer.x - drag.grip.x * CELL - view.grab.x} top={pointer.y - drag.grip.y * CELL - view.grab.y}
            className={`z-20 border-2 opacity-90 ${
              fits ? "border-verdigris bg-verdigris/20" : "border-error bg-error/25"
            }`}
          />
        )}
        {hovered && hover?.tooltip && pointer && (
          <ItemTooltip stack={hovered} at={pointer} panelWidth={panel.current?.clientWidth ?? 0} />
        )}
      </div>
    </PanelFrame>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-start" style={{ gap: INVENTORY_GAP_PX }}>{children}</div>;
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className={`flex items-center gap-2 ${LABEL}`}>
        {title}
        <span className="h-px flex-1 bg-linear-to-r from-bone/25 to-transparent" />
      </h3>
      {children}
    </section>
  );
}

const BURDEN_LOOK: Record<Burden, { fill: string; text: string }> = {
  light: { fill: "from-bone/50 to-bone/35", text: "text-bone" },
  heavy: { fill: "from-ping-fair to-ping-fair", text: "text-ping-fair" },
  overloaded: { fill: "from-hp to-hp-dark", text: "text-error" },
};

function Weight({ gear, stats }: { gear: Gear; stats: Stats }) {
  const weight = gearWeight(gear), limit = carryLimit(stats);
  const burden = gearBurden(gear, stats);
  const look = BURDEN_LOOK[burden];
  return (
    <div id="bag-weight" data-burden={burden} className="mt-0.5 w-0 min-w-full text-xs">
      <div className="flex items-baseline justify-between">
        <span className={LABEL}>Weight</span>
        <span className="tabular-nums">
          <span className={`font-semibold ${look.text}`}>{formatWeight(weight)}</span>
          <span className="text-bone/45"> / {formatWeight(limit)}</span>
        </span>
      </div>
      <Bar fraction={Math.min(1, weight / limit)} fill={look.fill} className="mt-1.5 h-1.5" />
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

interface Sale {
  each: number;
  sell: (count: number) => void;
}

interface Carving {
  price: CarvePrice;
  carve: () => void;
}

function saleOf(selected: Spot | null, trade: Trading, request: GameRequests["request"]): ((stack: BagItem) => Sale | Carving | null) | null {
  if (!selected || selected.in === "slot" || selected.in === "pile") return null;
  const at: UseSpot = { in: selected.in, x: selected.x, y: selected.y };
  return (stack) => {
    const def = itemDef(stack.item), carving = trade.shop.carving;
    if (carving && def.inscription) {
      return { price: carving.carve[def.rarity], carve: () => request({ t: "carve", at }) };
    }
    const each = trade.shop.buys[stack.item];
    return each === undefined ? null : { each, sell: (count) => request({ t: "sell", at, count }) };
  };
}

interface DetailsProps {
  gear: Gear;
  /** The selected stack. */
  stack: BagItem | null;
  usable: boolean;
  using: boolean;
  use: () => void;
  sale: ((stack: BagItem) => Sale | Carving | null) | null;
}

function BagDetails({ gear, stack, usable, using, use, sale }: DetailsProps) {
  if (!stack) {
    return (
      <p id="bag-details" className={`${DETAILS_STRIP} text-sm text-bone/45 italic`}>
        {gear.bag.items.length + gear.pack.items.length === 0
          ? "Nothing in the bag yet. Boars sometimes drop things." : ""}
      </p>
    );
  }
  const def = itemDef(stack.item), verb = def.consumable?.verb ?? def.wearable?.verb;
  const offer = sale?.(stack) ?? null;
  const selling = offer && "sell" in offer ? offer : null, carving = offer && "carve" in offer ? offer : null;
  return (
    <div id="bag-details" data-item={stack.item} className={`${DETAILS_STRIP} flex items-start gap-4`}>
      <div
        className={`relative shrink-0 cut-7 clip-cut ${WELL}`}
        style={{ width: DETAILS_PICTURE_PX, height: DETAILS_PICTURE_PX }}
      >
        <ItemPicture item={stack.item} turned={false} maxPx={DETAILS_PICTURE_PX - 8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold tracking-[0.16em] uppercase ${RARITY_TEXT[def.rarity]}`}>
          {def.name} {stack.count > 1 && <span className="text-bone tabular-nums">×{stack.count}</span>}
        </div>
        <p className="mt-0.5 text-xs text-bone/60">
          {def.description}{def.consumable ? ` ${effectsText(def.consumable.effects)}` : ""}
          {def.inscription ? ` ${INSCRIPTION_TEXT[def.inscription]}` : ""}
        </p>
        <p className="mt-1 text-[11px] text-bone/40 tabular-nums">Weight {itemInfo(stack).weight}</p>
      </div>
      {selling && (
        <div className="flex flex-col gap-1.5 self-center">
          <button
            type="button" id="bag-sell" {...NO_FOCUS} disabled={using} onClick={() => selling.sell(1)}
            className={`pointer-events-auto ${BUTTON.primary}`}
          >
            Sell for {formatPrice(selling.each)}
          </button>
          {stack.count > 1 && (
            <button
              type="button" id="bag-sell-all" {...NO_FOCUS} disabled={using} onClick={() => selling.sell(stack.count)}
              className={`pointer-events-auto ${BUTTON.plain}`}
            >
              All {stack.count} for {formatPrice(selling.each * stack.count)}
            </button>
          )}
        </div>
      )}
      {carving && (
        <button
          type="button" id="bag-carve" {...NO_FOCUS} disabled={using} onClick={carving.carve}
          className={`pointer-events-auto self-center ${BUTTON.primary}`}
        >
          Carve for {formatPrice(carving.price.copper)} + {carving.price.essence} essence
        </button>
      )}
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

// w-0 min-w-full: as wide as the grids above, without a long description widening the panel.
const DETAILS_STRIP = "mt-4 min-h-[88px] w-0 min-w-full border-t border-bone/13 pt-3";
const DETAILS_PICTURE_PX = 72;
