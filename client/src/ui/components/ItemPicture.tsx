/**
 * An item's picture (gfx/items/), `scale` screen pixels per art pixel, filling the cells it covers. A turned item
 * is the same picture turned 90° clockwise.
 */
import { ITEMS, type ItemId } from "@infinite-tower/shared";
import { useEffect, useRef } from "react";
import { drawItem } from "../../gfx/items/items.js";

export function ItemPicture({ item, turned, scale }: { item: ItemId; turned: boolean; scale: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pic = drawItem(item);
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
