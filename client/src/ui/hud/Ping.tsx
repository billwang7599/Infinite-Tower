import { useGame } from "../context.js";
import { useStore } from "../useStore.js";

export function pingReadout(ms: number | null): { text: string; color: string } {
  if (ms === null) return { text: "—", color: "text-bone/60" };
  return { text: `${ms} ms`, color: ms < 100 ? "text-ping-good" : ms < 200 ? "text-ping-fair" : "text-ping-poor" };
}

/** Wide enough for four digits, so what's beside it doesn't shift. */
export function Ping() {
  const { ui: { ping }, settings: { hud } } = useGame();
  const ms = useStore(ping, (s) => s.ms);
  const shown = useStore(hud, (s) => s.showPing);
  if (!shown) return null;
  const { text, color } = pingReadout(ms);
  return (
    <div id="ping" className="flex min-w-16 items-center gap-1.5 text-xs tabular-nums">
      <span className={`size-[7px] rounded-full bg-current ${color}`} />
      {text}
    </div>
  );
}
