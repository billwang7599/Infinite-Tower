/** The player's standing frame in a given look, drawn big on a plain 2D canvas (no Babylon). */
import type { Look } from "@infinite-tower/shared";
import { useEffect, useRef } from "react";
import { playerFrames } from "../../../gfx/characters.js";

const PIXELS = 24;
const SCALE = 6;

export function SpritePreview({ look }: { look: Look }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PIXELS * SCALE, PIXELS * SCALE);
    playerFrames(look).idle((x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
    });
  }, [look]);
  return <canvas ref={canvas} width={PIXELS * SCALE} height={PIXELS * SCALE} aria-hidden className="[image-rendering:pixelated]" />;
}
