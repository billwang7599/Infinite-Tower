/**
 * The title's two sequences, as timing only (TitleScreen.tsx draws them):
 *
 *   enter (Play, or a login that worked): the title text fades, the view glides into the tower to its middle and
 *         looks straight up it (it goes up forever, into the light), then rushes up it, speeding up, until the game
 *         is ready (the server has loaded the player and the level), at least for a while; a white flash, and the
 *         white clears over the world.
 *   leave (Return to title, or a lost connection): white over the world (the game stops under it, at
 *         LEAVE_COVERED_MS), falling back down the tower to a stop, looking down, backing out of it, the menu.
 *
 * With reduced motion there are no camera moves and no rush to watch, just the fades.
 */
import type { TitleState } from "../../state.js";

export type Stage =
  | "menu"
  | "fade" | "approach" | "lookUp" | "rush" | "flash" | "reveal" | "done"
  | "whiteout" | "rushOut" | "pullBack";

export interface Step {
  stage: Stage;
  ms: number;
  /** Holds until the game is ready, and for at least `ms`. */
  untilReady?: boolean;
}

/** One sequence playing, from `startedAt` (ms, performance.now()). `readyAt`: when the game joined (enter only). */
export interface Run {
  kind: "enter" | "leave";
  startedAt: number;
  readyAt: number | null;
}

const ENTER: readonly Step[] = [
  { stage: "fade", ms: 400 },
  { stage: "approach", ms: 1300 },
  { stage: "lookUp", ms: 1500 },
  { stage: "rush", ms: 1600, untilReady: true },
  { stage: "flash", ms: 350 },
  { stage: "reveal", ms: 750 },
];
const LEAVE: readonly Step[] = [
  { stage: "whiteout", ms: 500 },
  { stage: "rushOut", ms: 700 },
  { stage: "pullBack", ms: 1700 },
];
/** Steps that are only movement take no time with reduced motion. */
const MOTION_ONLY: readonly Stage[] = ["approach", "lookUp", "rush", "rushOut", "pullBack"];
const STILL = (steps: readonly Step[]) =>
  steps.map((s) => (MOTION_ONLY.includes(s.stage) ? { ...s, ms: 0 } : s));
const STEPS = {
  enter: { moving: ENTER, still: STILL(ENTER) },
  leave: { moving: LEAVE, still: STILL(LEAVE) },
};

/** From the start of leaving until the white covers the world, so the game can stop unseen. */
export const LEAVE_COVERED_MS = LEAVE[0]!.ms;

export function stepsOf(kind: Run["kind"], reducedMotion: boolean): readonly Step[] {
  return STEPS[kind][reducedMotion ? "still" : "moving"];
}

/** How long `stage` plays (the shortest, for one that waits for the game), for the screen's transitions. */
export function stageMs(stage: Stage): number {
  return [...ENTER, ...LEAVE].find((step) => step.stage === stage)?.ms ?? 0;
}

/**
 * The stage `run` is at, `now`, and how many ms until that changes (null: not by itself; it's waiting for the
 * game, or finished). No run is the menu; a finished enter is "done" (the title is gone), a finished leave the menu.
 */
export function runStage(
  run: Run | null, now: number, reducedMotion: boolean,
): { stage: Stage; nextInMs: number | null } {
  if (!run) return { stage: "menu", nextInMs: null };
  const elapsed = now - run.startedAt;
  const readyAfter = run.readyAt === null ? Infinity : run.readyAt - run.startedAt;
  let end = 0;
  for (const step of stepsOf(run.kind, reducedMotion)) {
    end += step.ms;
    if (step.untilReady) end = Math.max(end, readyAfter);
    if (elapsed < end) return { stage: step.stage, nextInMs: end === Infinity ? null : end - elapsed };
  }
  return { stage: run.kind === "enter" ? "done" : "menu", nextInMs: null };
}

/** The run after the title's phase changes to `phase`, `now`. */
export function nextRun(run: Run | null, phase: TitleState["phase"], now: number): Run | null {
  switch (phase) {
    case "connecting":
    case "loading":
      return run?.kind === "enter" ? run : { kind: "enter", startedAt: now, readyAt: null };
    case "entering":
      if (run?.kind !== "enter") return { kind: "enter", startedAt: now, readyAt: now };
      return run.readyAt === null ? { ...run, readyAt: now } : run;
    case "returning":
      return run?.kind === "leave" ? run : { kind: "leave", startedAt: now, readyAt: null };
    default:
      // Back at the menu: a failed enter is called off; a leave plays out.
      return run?.kind === "leave" ? run : null;
  }
}
