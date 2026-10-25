/**
 * The title's scene (draw.ts) on a canvas the size of the screen, with the glow layer blurred over it, following
 * the sequence's `stage` (path.ts). It redraws every frame; on the menu, where only the light on the tower and the
 * crystals move, every other frame. `still` (reduced motion): one picture of the title's view, redrawn on resize.
 */
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type { Stage } from "../sequence.js";
import { drawFrame } from "./draw.js";
import { shotAt, titlePose } from "./path.js";
import { buildFloor } from "./world.js";

const FLOOR = buildFloor();
/** Sharper than this costs more than it shows. */
const MAX_PIXEL_RATIO = 2;
/** The glow layer's size against the screen: it's blurred anyway. */
const GLOW_SCALE = 0.35;
const MENU_FRAME_MS = 30;

export const Scene = memo(function Scene({ stage, still }: { stage: Stage; still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const timing = useRef({ stage, since: performance.now(), rushSince: performance.now() });

  useLayoutEffect(() => {
    const now = performance.now();
    if (timing.current.stage === stage) return;
    timing.current = { stage, since: now, rushSince: stage === "rush" ? now : timing.current.rushSince };
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const glowCanvas = glowRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const glow = glowCanvas.getContext("2d")!;
    const started = performance.now();
    let frame = 0;
    let drawnAt = -Infinity;

    const draw = () => {
      const now = performance.now();
      const ratio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1);
      const [w, h] = [Math.round(canvas.clientWidth * ratio), Math.round(canvas.clientHeight * ratio)];
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        [canvas.width, canvas.height] = [w, h];
        [glowCanvas.width, glowCanvas.height] = [Math.round(w * GLOW_SCALE), Math.round(h * GLOW_SCALE)];
      }
      const { stage, since, rushSince } = timing.current;
      const shot = still
        ? { pose: titlePose(w / h), speed: 0 }
        : shotAt(stage, (now - since) / 1000, (now - rushSince) / 1000, w / h);
      drawFrame(ctx, glow, FLOOR, shot, still ? 0 : (now - started) / 1000);
      drawnAt = now;
    };
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (timing.current.stage === "menu" && performance.now() - drawnAt < MENU_FRAME_MS) return;
      draw();
    };

    if (!still) loop();
    else draw();
    const resized = new ResizeObserver(() => (still ? draw() : (drawnAt = -Infinity)));
    resized.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
    };
  }, [still]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <canvas ref={glowRef} className="absolute inset-0 size-full opacity-70 mix-blend-screen blur-[10px]" />
    </>
  );
});
