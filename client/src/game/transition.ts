/** Screen transitions between modes: Pokémon-style white flashes into battle, a black fade back. */
import { clamp, smoothstep } from "@infinite-tower/shared";

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
  /** On the one frame the screen is covered and the mode should switch. */
  swapNow: boolean;
  done: boolean;
}

/** When the mode switches (screen fully covered), and when the overlay is gone. */
const TIMING = { battle: { swapTime: 0.85, endTime: 1.25 }, overworld: { swapTime: 0.4, endTime: 0.8 } } as const;
/** Into battle: the white flashes, on and off every FLASH_PERIOD until FLASH_END_TIME, before the fade. */
const FLASH_END_TIME = 0.6;
const FLASH_PERIOD = 0.1;
const FLASH_OPACITY = 0.85;
/** Each flash is lit for half its period, fading off over it like a camera's. */
const FLASH_ON_SHARE = 0.5;

export function startTransition(to: Mode): Transition {
  return { to, time: 0, swapped: false };
}

export function stepTransition(tr: Transition, dt: number): TransitionFrame {
  tr.time += dt;
  const { swapTime, endTime } = TIMING[tr.to];
  let color = "#000", opacity: number;
  if (tr.to === "battle" && tr.time < FLASH_END_TIME) {
    color = "#fff";
    const into = (tr.time % (2 * FLASH_PERIOD)) / (2 * FLASH_PERIOD * FLASH_ON_SHARE);
    opacity = into < 1 ? FLASH_OPACITY * (1 - into) ** 2 : 0;
  } else if (tr.time < swapTime) {
    opacity = smoothstep(tr.to === "battle" ? FLASH_END_TIME : 0, swapTime, tr.time);
  } else {
    opacity = 1 - smoothstep(swapTime, endTime, tr.time);
  }
  const swapNow = tr.time >= swapTime && !tr.swapped;
  if (swapNow) tr.swapped = true;
  const done = tr.time >= endTime;
  return { color, opacity: done ? 0 : clamp(opacity, 0, 1), swapNow, done };
}
