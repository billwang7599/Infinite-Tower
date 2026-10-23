/** Screen transitions between modes: Pokémon-style white flashes into battle, a black fade back. */
import { clamp } from "@infinite-tower/shared";


/** The two modes: the 2D field (field/) and the 2.5D arena fight (battle/). */
export type Mode = "field" | "battle";

export interface Transition { to: Mode; t: number; swapped: boolean }

export interface TransitionFrame {
  color: string;
  opacity: number;
  /** True on the one frame where the screen is covered and the mode should switch. */
  swapNow: boolean;
  done: boolean;
}

/** Seconds: when the mode switches (screen fully covered), and when the overlay is gone. */
const TIMING = { battle: { swap: 0.85, end: 1.25 }, field: { swap: 0.4, end: 0.8 } } as const;
const FLASHES_UNTIL = 0.6;

export function startTransition(to: Mode): Transition {
  return { to, t: 0, swapped: false };
}

export function stepTransition(tr: Transition, dt: number): TransitionFrame {
  tr.t += dt;
  const { swap, end } = TIMING[tr.to];
  let color = "#000", opacity: number;
  if (tr.to === "battle" && tr.t < FLASHES_UNTIL) {
    color = "#fff";
    opacity = Math.floor(tr.t / 0.1) % 2 === 0 ? 0.85 : 0;
  } else if (tr.t < swap) {
    const from = tr.to === "battle" ? FLASHES_UNTIL : 0;
    opacity = (tr.t - from) / (swap - from);
  } else {
    opacity = 1 - (tr.t - swap) / (end - swap);
  }
  const swapNow = tr.t >= swap && !tr.swapped;
  if (swapNow) tr.swapped = true;
  const done = tr.t >= end;
  return { color, opacity: done ? 0 : clamp(opacity, 0, 1), swapNow, done };
}
