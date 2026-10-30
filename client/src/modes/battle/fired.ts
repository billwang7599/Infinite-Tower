import type { StepEvent } from "./sync.js";

// Longer than any replay after a resync goes back.
const EFFECT_MEMORY_STEPS = 180;

export class FiredEffects {
  private readonly fired = new Map<string, number>();

  take(events: readonly StepEvent[]): StepEvent[] {
    const fresh = events.filter(({ step, event }) => {
      const key = `${step} ${JSON.stringify(event)}`;
      if (this.fired.has(key)) return false;
      this.fired.set(key, step);
      return true;
    });
    const latest = Math.max(...events.map((e) => e.step));
    for (const [key, step] of this.fired) if (step < latest - EFFECT_MEMORY_STEPS) this.fired.delete(key);
    return fresh;
  }
}
