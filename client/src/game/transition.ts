/** Screen transitions between modes: Pokémon-style white flashes into battle, a black fade back. */
import { clamp } from "@infinite-tower/shared";

/** The two modes: the 2D overworld (overworld/) and the 2.5D arena fight (battle/). */
export type Mode = "overworld" | "battle";

export interface Transition {
  to: Mode;
  /** Seconds since it started. */
  time: number;
  swapped: boolean;
}

interface TransitionFrame {
  color: string;
  opacity: number;
  /** True on the one frame where the screen is covered and the mode should switch. */
  swapNow: boolean;
  done: boolean;
}

/** When the mode switches (screen fully covered), and when the overlay is gone. */
const TIMING = { battle: { swapTime: 0.85, endTime: 1.25 }, overworld: { swapTime: 0.4, endTime: 0.8 } } as const;
/** Into battle: the white flashes, on and off every FLASH_PERIOD until FLASH_END_TIME, before the fade. */
const FLASH_END_TIME = 0.6;
const FLASH_PERIOD = 0.1;
const FLASH_OPACITY = 0.85;

export function startTransition(to: Mode): Transition {
  return { to, time: 0, swapped: false };
}

export function stepTransition(tr: Transition, dt: number): TransitionFrame {
  tr.time += dt;
  const { swapTime, endTime } = TIMING[tr.to];
  let color = "#000", opacity: number;
  if (tr.to === "battle" && tr.time < FLASH_END_TIME) {
    color = "#fff";
    opacity = Math.floor(tr.time / FLASH_PERIOD) % 2 === 0 ? FLASH_OPACITY : 0;
  } else if (tr.time < swapTime) {
    const from = tr.to === "battle" ? FLASH_END_TIME : 0;
    opacity = (tr.time - from) / (swapTime - from);
  } else {
    opacity = 1 - (tr.time - swapTime) / (endTime - swapTime);
  }
  const swapNow = tr.time >= swapTime && !tr.swapped;
  if (swapNow) tr.swapped = true;
  const done = tr.time >= endTime;
  return { color, opacity: done ? 0 : clamp(opacity, 0, 1), swapNow, done };
}
