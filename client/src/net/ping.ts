/** The HUD's ping: a `ping` over the game socket every 2 s, reported as the average of the last 4 round trips. */
import type { Net } from "./net.js";

const PING_EVERY_MS = 2000;
const SAMPLES = 4;
/** Past this many unanswered pings the oldest is given up on, so a dead link doesn't pile them up. */
const MAX_WAITING = 8;

export interface Pinging {
  pong(id: number): void;
  stop(): void;
}

/** The first ping goes one interval in: just after joining, the page is busy, so its reply would skew the average. */
export function startPinging(
  net: Pick<Net, "send">, report: (ms: number) => void, now: () => number = () => performance.now(),
): Pinging {
  let nextId = 0;
  const sentAt = new Map<number, number>();
  const samples: number[] = [];
  const timer = setInterval(() => {
    const id = nextId++;
    sentAt.set(id, now());
    if (sentAt.size > MAX_WAITING) sentAt.delete(sentAt.keys().next().value!);
    net.send({ t: "ping", id });
  }, PING_EVERY_MS);
  return {
    pong(id) {
      const sent = sentAt.get(id);
      if (sent === undefined) return;
      // Pongs come in order, so any ping older than this one is stale.
      for (const waiting of sentAt.keys()) if (waiting <= id) sentAt.delete(waiting);
      samples.push(now() - sent);
      if (samples.length > SAMPLES) samples.shift();
      report(Math.round(samples.reduce((sum, ms) => sum + ms, 0) / samples.length));
    },
    stop() {
      clearInterval(timer);
      sentAt.clear();
    },
  };
}
