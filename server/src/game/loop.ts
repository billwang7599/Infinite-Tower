/** Fixed 60 Hz simulation for every session, catching up after stalls (at most 0.25 s). */
import { FIXED_DT } from "@infinite-tower/shared";
import type { Session } from "./session.js";

export function startLoop(sessions: Iterable<Session>): void {
  let last = performance.now(), acc = 0;
  setInterval(() => {
    const now = performance.now();
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= FIXED_DT) {
      for (const s of sessions) s.tick(FIXED_DT);
      acc -= FIXED_DT;
    }
  }, 5);
}
