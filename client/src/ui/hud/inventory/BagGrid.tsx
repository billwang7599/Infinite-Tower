/**
 * The bag as a grid: its cells and what's in them, with the mouse's three states drawn apart (bagMouse.ts): a light
 * highlight behind the hovered item (and its tooltip once the pointer rests), a gold outline on the selected one,
 * and while dragging, a ghost under the pointer, green where it fits and red where it doesn't, with a dashed outline
 * where it would land. It only draws and reports the pointer; the panel decides what that does.
 */
import { footprint, type Bag, type BagItem, type Cell } from "@infinite-tower/shared";
import { useRef, type MouseEvent } from "react";
import { ItemPicture } from "../../components/ItemPicture.js";
import { hoveredStack, landing, selectedStack, type BagMouse, type Pointer } from "./bagMouse.js";
import { CELL, SCALE } from "./grid.js";
import { ItemTooltip } from "./ItemTooltip.js";

/** MouseEvent.button, and its bit in PointerEvent.buttons. */
const MAIN = { button: 0, bit: 1 };
const SECONDARY = { button: 2, bit: 2 };

export interface GridEvents {
  down(p: Pointer): void;
  /** null: the pointer left the grid. */
  move(p: Pointer | null): void;
  up(p: Pointer): void;
  cancel(): void;
  /** A right press. */
  turn(): void;
  doubleClick(p: Pointer): void;
}

interface GridProps {
  bag: Bag;
  mouse: BagMouse;
  /** Whether the dragged item can go down where it would land. */
  fits: boolean;
  /** Where in its grip cell the dragged item is held, in pixels, so the ghost doesn't jump as the drag starts. */
  grab: Cell;
  on: GridEvents;
}

export function BagGrid({ bag, mouse, fits, grab, on }: GridProps) {
  const grid = useRef<HTMLDivElement>(null);
  const at = (e: MouseEvent): Pointer => {
    const box = grid.current!.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const cell = { x: Math.floor(x / CELL), y: Math.floor(y / CELL) };
    return { cell, inside: cell.x >= 0 && cell.y >= 0 && cell.x < bag.cols && cell.y < bag.rows, x, y };
  };
  const { drag, pointer } = mouse;
  const hovered = hoveredStack(mouse, bag);
  const selected = drag ? null : selectedStack(mouse, bag);
  const dragged = drag && bag.items.find((s) => s.x === drag.from.x && s.y === drag.from.y);
  const spot = landing(mouse, bag);

  return (
    <div
      ref={grid} id="bag-grid" data-cols={bag.cols} data-rows={bag.rows}
      className="pointer-events-auto relative touch-none select-none"
      style={{ width: bag.cols * CELL, height: bag.rows * CELL }}
      onPointerDown={(e) => {
        if (e.button === SECONDARY.button) on.turn();
        if (e.button !== MAIN.button) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        on.down(at(e));
      }}
      onPointerMove={(e) => {
        // A button pressed or let go while another is held comes as a move, not a down or an up (chorded buttons).
        if (e.button === SECONDARY.button && e.buttons & SECONDARY.bit) on.turn();
        if (e.button === MAIN.button && !(e.buttons & MAIN.bit)) on.up(at(e));
        else on.move(at(e));
      }}
      onPointerUp={(e) => { if (e.button === MAIN.button) on.up(at(e)); }}
      onPointerLeave={() => on.move(null)}
      onPointerCancel={() => on.cancel()}
      onDoubleClick={(e) => on.doubleClick(at(e))}
    >
      <div
        className="absolute inset-0 grid border border-white/15 bg-black/45"
        style={{ gridTemplateColumns: `repeat(${bag.cols}, ${CELL}px)` }}
      >
        {Array.from({ length: bag.cols * bag.rows }, (_, i) => (
          <div key={i} className="border border-white/[0.06]" />
        ))}
      </div>
      {hovered && <Box id="bag-hover" stack={hovered} className="border border-white/30 bg-white/15" />}
      {bag.items.map((stack) => (
        <Placed
          key={`${stack.x},${stack.y}`} stack={stack} left={stack.x * CELL} top={stack.y * CELL} turned={stack.turned}
          className={stack === dragged ? "opacity-25" : ""}
        />
      ))}
      {selected && (
        <Box id="bag-selected" stack={selected} className="border-2 border-victory shadow-[0_0_10px_#e8c45a99]" />
      )}
      {drag && spot && (
        <div
          id="bag-landing" data-fits={fits} data-x={spot.x} data-y={spot.y}
          className={`pointer-events-none absolute border-2 border-dashed ${fits ? "border-stamina" : "border-hp"}`}
          style={area(spot, footprint(drag.item, drag.turned))}
        />
      )}
      {drag && dragged && pointer && (
        <Placed
          id="bag-ghost" data-fits={fits} stack={dragged} turned={drag.turned}
          left={pointer.x - drag.grip.x * CELL - grab.x} top={pointer.y - drag.grip.y * CELL - grab.y}
          className={`z-20 border-2 opacity-90 ${fits ? "border-stamina bg-stamina/20" : "border-hp bg-hp/25"}`}
        />
      )}
      {hovered && mouse.hover?.tooltip && <ItemTooltip stack={hovered} bag={bag} />}
    </div>
  );
}

const area = (at: Cell, size: { cols: number; rows: number }) =>
  ({ left: at.x * CELL, top: at.y * CELL, width: size.cols * CELL, height: size.rows * CELL });

interface PlacedProps {
  id?: string;
  "data-fits"?: boolean;
  stack: BagItem;
  /** Pixels from the grid's top-left. */
  left: number;
  top: number;
  turned: boolean;
  className: string;
}

/** A stack's picture over the cells it covers, with its count when there's more than one. */
function Placed({ stack, left, top, turned, className, ...attrs }: PlacedProps) {
  const { cols, rows } = footprint(stack.item, turned);
  return (
    <div
      {...attrs} data-item={stack.item} data-x={stack.x} data-y={stack.y} data-turned={turned}
      className={`pointer-events-none absolute ${className}`}
      style={{ left, top, width: cols * CELL, height: rows * CELL }}
    >
      <ItemPicture item={stack.item} turned={turned} scale={SCALE} />
      {stack.count > 1 && (
        <span className="absolute right-1 bottom-0.5 text-xs font-semibold tabular-nums [text-shadow:0_1px_2px_#000]">
          {stack.count}
        </span>
      )}
    </div>
  );
}

/** A frame over the cells a stack covers: the hover's highlight, the selection's outline. */
function Box({ id, stack, className }: { id: string; stack: BagItem; className: string }) {
  return (
    <div
      id={id} data-x={stack.x} data-y={stack.y}
      className={`pointer-events-none absolute ${className}`} style={area(stack, footprint(stack.item, stack.turned))}
    />
  );
}
