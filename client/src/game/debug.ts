/**
 * Dev handles for the browser console and browser tests (in dev, or with `?debug`). The fighters are in
 * `battle.fight.world` while a fight is on; `encounter()` fights a wild boar, or the enemy named (dev servers only).
 */
import * as shared from "@infinite-tower/shared";
import type { Battle } from "../modes/battle/battle.js";
import * as battleComponents from "../modes/battle/components.js";
import * as playerComponents from "../modes/battle/player/components.js";
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
  mode: () => Mode | null;
  encounter: (enemy?: string) => void;
}

export function exposeDebugHandles(h: DebugHandles): void {
  if (!import.meta.env.DEV && !new URLSearchParams(location.search).has("debug")) return;
  Object.assign(window, {
    battle: h.battle.ctx, overworld: h.overworld.view, mode: h.mode, ui: h.ui, settings: h.settings,
    encounter: h.encounter,
    cast: (spell: shared.Spell) => h.battle.ctx.casts.push(spell),
    components: { ...shared, ...battleComponents, ...playerComponents, ...overworldComponents },
  });
}
