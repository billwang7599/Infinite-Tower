/**
 * A grid of the bag screen (the bag or the cloth), with the mouse's states drawn (bagMouse.ts): hovered, selected,
 * and where a dragged item would land (green where it fits, red where it doesn't). It only draws; the panel reads
 * the pointer and decides what that does.
 */
import {
  footprint, ITEMS, type BagItem, type Cell, type Gear, type GridName, type ItemId,
} from "@infinite-tower/shared";
import { useEffect, useRef } from "react";
import { drawItem } from "../../../gfx/items/items.js";
import { hoveredStack, landing, selectedStack, type BagMouse } from "./bagMouse.js";
import { CELL, GRID_FRAME_PX, SCALE } from "./grid.js";
import { itemInfo } from "./itemInfo.js";

interface GridProps {
  name: GridName;
  gear: Gear;
  mouse: BagMouse;
  /** The dragged item can go down where it would land. */
  fits: boolean;
  area: (el: HTMLDivElement | null) => void;
}

export function BagGrid({ name, gear, mouse, fits, area }: GridProps) {
  const grid = gear[name];
  const { drag } = mouse;
  const hovered = mouse.hover?.stack.in === name ? hoveredStack(mouse, gear) : null;
  const selected = !drag && mouse.selected?.in === name ? selectedStack(mouse, gear) : null;
  const from = drag?.from;
  const dragged = from && from.in === name ? grid.items.find((s) => s.x === from.x && s.y === from.y) : undefined;
  const spot = landing(mouse, gear);
  const lands = drag && spot && spot.in === name ? spot : null;
  const edge = fits ? "border-stamina" : "border-hp";

  return (
    <div
      className="rounded-sm border border-white/15 bg-black/60 shadow-[inset_0_2px_10px_#000,0_1px_0_#ffffff0d]"
      style={{ padding: GRID_FRAME_PX - 1 }}
    >
      <div
        ref={area} id={`${name}-grid`} data-cols={grid.cols} data-rows={grid.rows}
        className="relative touch-none select-none" style={{ width: grid.cols * CELL, height: grid.rows * CELL }}
      >
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${CELL}px)` }}>
          {Array.from({ length: grid.cols * grid.rows }, (_, i) => (
            <div
              key={i}
              className="rounded-[2px] border border-black/70 bg-white/[0.035] shadow-[inset_0_1px_0_#ffffff0f]"
            />
          ))}
        </div>
        {hovered && <Box id={`${name}-hover`} stack={hovered} className="border border-white/30 bg-white/15" />}
        {grid.items.map((stack) => (
          <Placed
            key={`${stack.x},${stack.y}`} stack={stack} left={stack.x * CELL} top={stack.y * CELL}
            turned={stack.turned} className={`${ITEM_FRAME} ${stack === dragged ? "opacity-25" : ""}`}
          />
        ))}
        {selected && (
          <Box
            id={`${name}-selected`} stack={selected} className="border-2 border-victory shadow-[0_0_10px_#e8c45a99]"
          />
        )}
        {drag && lands && (
          <div
            id={`${name}-landing`} data-fits={fits} data-x={lands.x} data-y={lands.y}
            className={`pointer-events-none absolute rounded-[2px] border-2 border-dashed ${edge}`}
            style={cellBox(lands, footprint(drag.item, drag.turned))}
          />
        )}
      </div>
    </div>
  );
}

const ITEM_FRAME =
  "rounded-[2px] border border-white/10 bg-linear-to-b from-white/[0.09] to-white/[0.02] "
  + "shadow-[inset_0_0_0_1px_#0008]";

const cellBox = (at: Cell, size: { cols: number; rows: number }) =>
  ({ left: at.x * CELL, top: at.y * CELL, width: size.cols * CELL, height: size.rows * CELL });

interface PlacedProps {
  id?: string;
  "data-fits"?: boolean;
  stack: BagItem;
  left: number;
  top: number;
  turned: boolean;
  className: string;
}

/** A stack's picture over the cells it covers, with its count when there's more than one. */
export function Placed({ stack, left, top, turned, className, ...attrs }: PlacedProps) {
  const { cols, rows } = footprint(stack.item, turned);
  return (
    <div
      {...attrs} data-item={stack.item} data-x={stack.x} data-y={stack.y} data-turned={turned}
      className={`pointer-events-none absolute ${className}`}
      style={{ left, top, width: cols * CELL, height: rows * CELL }}
    >
      <ItemPicture item={stack.item} turned={turned} />
      {stack.count > 1 && (
        <span
          className={
            "absolute right-0.5 bottom-0.5 rounded-[2px] bg-black/75 px-1 text-[11px] leading-4 font-semibold "
            + "tabular-nums"
          }
        >
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
      className={`pointer-events-none absolute rounded-[2px] ${className}`}
      style={cellBox(stack, footprint(stack.item, stack.turned))}
    />
  );
}

/** At SCALE, or smaller to fit in `maxPx`. A turned item is the same picture turned 90° clockwise. */
export function ItemPicture({ item, turned, maxPx }: { item: ItemId; turned: boolean; maxPx?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pic = drawItem(item);
  const scale = maxPx ? Math.min(SCALE, Math.floor(maxPx / Math.max(pic.width, pic.height))) : SCALE;
  useEffect(() => {
    canvas.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pic.rgba), pic.width), 0, 0);
  }, [pic]);
  const { cols, rows } = ITEMS[item];
  return (
    <canvas
      ref={canvas} width={pic.width} height={pic.height} aria-hidden data-item={item}
      className="absolute top-1/2 left-1/2 [image-rendering:pixelated]"
      style={{
        width: pic.width * scale, height: pic.height * scale,
        transform: `translate(-50%, -50%)${turned && cols !== rows ? " rotate(90deg)" : ""}`,
      }}
    />
  );
}

export function ItemTooltip({ stack, at, panelWidth }: { stack: BagItem; at: Cell; panelWidth: number }) {
  const info = itemInfo(stack);
  const side = at.x > panelWidth / 2 ? { right: panelWidth - at.x } : { left: at.x };
  return (
    <div
      id="bag-tooltip" role="tooltip" data-item={stack.item}
      className={
        "pointer-events-none absolute z-30 w-max max-w-60 rounded-sm border border-white/20 bg-night/95 px-3 py-2 "
        + "text-xs font-normal shadow-[0_8px_24px_#000a]"
      }
      style={{ top: at.y + 20, ...side }}
    >
      <div className="mb-1 border-b border-white/10 pb-1 font-title text-sm text-victory">{info.name}</div>
      <div className="text-white/65 tabular-nums">Size {info.size}</div>
      <div className="text-white/65 tabular-nums">Weight {info.weight}</div>
      {info.effect && <div className="text-stamina">{info.effect}</div>}
    </div>
  );
}
