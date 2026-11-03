import { useGame } from "../context.js";
import { useStore } from "../useStore.js";

export function pingReadout(ms: number | null): { text: string; color: string } {
  if (ms === null) return { text: "—", color: "text-white/60" };
  return { text: `${ms} ms`, color: ms < 100 ? "text-ping-good" : ms < 200 ? "text-ping-fair" : "text-ping-poor" };
}

/** A dark pill so green reads on the grass; wide enough for four digits, so what's beside it doesn't shift. */
export function Ping() {
  const { ui: { ping }, settings: { hud } } = useGame();
  const ms = useStore(ping, (s) => s.ms);
  const shown = useStore(hud, (s) => s.showPing);
  if (!shown) return null;
  const { text, color } = pingReadout(ms);
  return (
    <div
      id="ping"
      className={`min-w-16 rounded-full bg-black/40 px-2.5 py-1 text-center text-[13px] tabular-nums ${color}`}
    >
      {text}
    </div>
  );
}
