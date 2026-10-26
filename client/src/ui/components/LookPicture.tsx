/**
 * A look (gfx/look/) on a canvas: the portrait, or the chibi facing front. Size it with `className` at a whole
 * multiple of the view's size (VIEWS in gfx/look/art.ts), so every pixel stays square.
 */
import type { Look } from "@infinite-tower/shared";
import { useEffect, useRef } from "react";
import { VIEWS } from "../../gfx/look/art.js";
import { drawChibi, drawPortrait } from "../../gfx/look/look.js";

export function LookPicture({ look, view, className }: { look: Look; view: "portrait" | "chibi"; className: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = VIEWS[view];
  useEffect(() => {
    const pic = view === "portrait" ? drawPortrait(look) : drawChibi(look, "front");
    canvas.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pic.rgba), width), 0, 0);
  }, [look, view, width]);
  return (
    <canvas
      ref={canvas} width={width} height={height} aria-hidden data-view={view}
      className={`[image-rendering:pixelated] ${className}`}
    />
  );
}
