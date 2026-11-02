import { useEffect, type RefObject } from "react";
import { type CoreSphere, SPHERE_PX } from "../../gfx/core/sphere.js";

const PAINT_GAP_MS = 1000 / 30;

export function usePaintedSphere(canvas: RefObject<HTMLCanvasElement | null>, sphere: CoreSphere, on: boolean): void {
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!on || !ctx) return;
    const image = ctx.createImageData(SPHERE_PX, SPHERE_PX);
    let frame = 0, paintedMs = -Infinity;
    const paint = (nowMs: number) => {
      frame = requestAnimationFrame(paint);
      if (nowMs - paintedMs < PAINT_GAP_MS) return;
      paintedMs = nowMs;
      sphere.frame(nowMs / 1000);
      sphere.paint(image.data, nowMs / 1000);
      ctx.putImageData(image, 0, 0);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [canvas, on, sphere]);
}
