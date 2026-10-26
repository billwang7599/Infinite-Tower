/**
 * The bag screen: the bag as a grid, how much it weighs against what you can carry, and the selected item. It's
 * worked with the mouse (bagMouse.ts): hover an item to highlight it (rest there for its tooltip), click to select
 * it, drag it to move it, right click to turn it. The bag keys (settings/bindings.ts) turn (what's dragged, or else
 * the selected item) and use the selected item, as do a double click and the Use button. While it's open you stand
 * still (`bagHasTheKeys`, ui/state.ts); Esc or the Inventory key closes it. Moves go to the server (`moveItem`),
 * which has the last word on the bag.
 */
import { bagBurden, bagWeight, carryLimit, type Burden, type Cell } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import type { KeyBindings } from "../../../settings/bindings.js";
import { useKeydown } from "../../components/useKeydown.js";
import type { OverworldHudState, SettingsScreenState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";
import { BagDetails } from "./BagDetails.js";
import { BagGrid, type GridEvents } from "./BagGrid.js";
import {
  cancel, canDrop, doubleClick, itemToUse, keepUp, NO_MOUSE, pointerDown, pointerMove, pointerUp, rightPress,
  selectedStack, tick, TOOLTIP_DELAY_MS, turnKey, type BagMouse, type Move,
} from "./bagMouse.js";
import { CELL } from "./grid.js";
import { formatWeight } from "./itemInfo.js";

interface PanelProps {
  hud: Store<OverworldHudState>;
  bindings: KeyBindings;
  settingsScreen: Store<SettingsScreenState>;
  use: (at: Cell) => void;
  move: (from: Cell, to: Cell, turned: boolean) => void;
  close: () => void;
}

/** The mouse, and where in its grip cell the dragged item is held (pixels), so its ghost doesn't jump. */
interface View {
  mouse: BagMouse;
  grab: Cell;
}

const START: View = { mouse: NO_MOUSE, grab: { x: CELL / 2, y: CELL / 2 } };

export function InventoryPanel({ hud, bindings, settingsScreen, use, move, close }: PanelProps) {
  const bag = useStore(hud, (s) => s.bag);
  const stats = useStore(hud, (s) => s.stats);
  // Healing items do nothing at full HP (the server refuses), so they can't be used then.
  const fullHp = useStore(hud, (s) => s.hpFraction >= 1);
  const settingsOpen = useStore(settingsScreen, (s) => s.open);
  const [view, setView] = useState<View>(START);
  /** The same as `view`, for events that come before the next render (a pointer leaving right after a drop). */
  const latest = useRef<View>(START);
  // The bag can change under the mouse (the server's answer, a meal eaten), so it's kept up with it every render.
  const mouse = keepUp(view.mouse, bag);

  const current = () => keepUp(latest.current.mouse, bag);
  /** The mouse is now `next`; the ghost's hold is taken as a drag starts and turned with it. */
  const set = (next: BagMouse) => {
    const before = latest.current.mouse;
    let { grab } = latest.current;
    const press = before.press?.at;
    if (!before.drag && next.drag && press) {
      grab = { x: press.x - press.cell.x * CELL, y: press.y - press.cell.y * CELL };
    } else if (before.drag && next.drag && before.drag.turned !== next.drag.turned) {
      grab = { x: grab.y, y: grab.x };
    }
    latest.current = { mouse: next, grab };
    setView(latest.current);
  };
  const send = (m: Move | null) => { if (m) move(m.from, m.to, m.turned); };
  const applyUse = (m: BagMouse) => {
    const at = itemToUse(m, bag, fullHp);
    if (at) use(at);
  };
  const turnWith = (turn: typeof turnKey) => {
    const { mouse: next, move: turned } = turn(current(), bag);
    set(next);
    send(turned);
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

  useKeydown((e) => {
    if (settingsOpen || e.repeat || e.target instanceof HTMLInputElement) return;
    const keys = bindings.get().bag;
    if (keys.turn.includes(e.code)) turnWith(turnKey);
    else if (keys.use.includes(e.code)) applyUse(current());
    else return;
    e.preventDefault();
  });
  // Esc closes the bag before it would open the settings (their listener is on the bubble phase).
  useKeydown((e) => {
    if (e.code !== "Escape" || e.repeat || settingsScreen.get().open) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, { capture: true });

  const on: GridEvents = {
    down: (p) => set(pointerDown(current(), bag, p)),
    move: (p) => set(pointerMove(current(), bag, p, performance.now())),
    up: (p) => {
      const { mouse: next, move: moved } = pointerUp(current(), bag, p, performance.now());
      set(next);
      send(moved);
    },
    cancel: () => set(cancel(current())),
    turn: () => turnWith(rightPress),
    doubleClick: (p) => {
      const next = doubleClick(current(), bag, p);
      set(next);
      applyUse(next);
    },
  };

  return (
    <PanelFrame id="inventory-panel" title="Inventory" close={close} width={bag.cols * CELL + 42}>
      <div className="pointer-events-auto" onContextMenu={(e) => e.preventDefault()}>
        {stats && (
          <p id="bag-weight" className="mb-3 text-xs text-white/55 tabular-nums">
            Weight {formatWeight(bagWeight(bag))} / {formatWeight(carryLimit(stats))}
            <BurdenNote burden={bagBurden(bag, stats)} />
          </p>
        )}
        <BagGrid bag={bag} mouse={mouse} fits={canDrop(mouse, bag)} grab={view.grab} on={on} />
        <BagDetails
          bag={bag} stack={selectedStack(mouse, bag)} usable={itemToUse(mouse, bag, fullHp) !== null}
          use={() => applyUse(current())}
        />
      </div>
    </PanelFrame>
  );
}

/** What carrying too much does to you right now (shared items/burden.ts). Nothing when it does nothing. */
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
