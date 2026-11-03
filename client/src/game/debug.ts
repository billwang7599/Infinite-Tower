/**
 * Dev handles for the browser console and browser tests (in dev, or with `?debug`). The fighters are in
 * `battle.fight.world` while a fight is on; `encounter()` fights a wild boar, or the enemy named (dev servers only).
 */
import * as shared from "@infinite-tower/shared";
import type { Audio } from "../audio/audio.js";
import type { Battle } from "../modes/battle/battle.js";
import * as overworldComponents from "../modes/overworld/components.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import type { Mode } from "./transition.js";

interface DebugHandles {
  battle: Battle;
  overworld: Overworld;
  ui: UiState;
  settings: Settings;
  audio: Audio;
  mode: () => Mode | null;
  setDayClock: (change: shared.DayChange) => void;
  encounter: (enemy?: shared.EnemyId) => void;
}

export function exposeDebugHandles(h: DebugHandles): void {
  const { setDayClock } = h;
  const params = new URLSearchParams(location.search);
  if (import.meta.env.DEV) {
    // `?time=0.75` freezes the time of day there (0 midnight, 0.5 noon).
    const time = params.get("time");
    if (time !== null && Number.isFinite(Number(time))) setDayClock({ fraction: Number(time), speed: 0 });
    Object.assign(window, { setDayClock, setTime: (fraction: number) => setDayClock({ fraction }) });
  }
  if (!import.meta.env.DEV && !params.has("debug")) return;
  Object.assign(window, {
    battle: h.battle.ctx, overworld: h.overworld.state, mode: h.mode, ui: h.ui, settings: h.settings,
    audio: h.audio.debug, encounter: h.encounter,
    cast: (skill: shared.Skill) => h.battle.ctx.casts.push(skill),
    components: { ...shared, ...overworldComponents },
  });
}
