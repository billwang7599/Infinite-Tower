/** The stage of the title's sequence (sequence.ts) for the title's phase, re-rendering when the stage changes. */
import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import type { TitleState } from "../../state.js";
import { nextRun, runStage, type Run, type Stage } from "./sequence.js";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function useSequence(phase: TitleState["phase"]): Stage {
  const reducedMotion = useReducedMotion();
  const [seen, setSeen] = useState(phase);
  const [run, setRun] = useState<Run | null>(null);
  const [ticks, tick] = useReducer((n: number) => n + 1, 0);

  // Worked out while rendering, not in an effect, so the first frame of a new phase already shows its stage
  // (returning must not flash the menu over the world first).
  let current = run;
  if (phase !== seen) {
    current = nextRun(run, phase, performance.now());
    setSeen(phase);
    setRun(current);
  }
  const { stage, nextInMs } = runStage(current, performance.now(), reducedMotion);

  useEffect(() => {
    if (nextInMs === null) return;
    const timer = setTimeout(tick, nextInMs);
    return () => clearTimeout(timer);
    // `ticks`: a timer that fires a hair early finds the same stage and has to set another.
  }, [current, stage, reducedMotion, ticks]);

  return stage;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = matchMedia(REDUCED_MOTION);
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    },
    () => matchMedia(REDUCED_MOTION).matches,
  );
}
