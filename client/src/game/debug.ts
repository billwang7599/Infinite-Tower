/**
 * Dev handles for the browser console (and the browser tests), set when a session starts (in dev, or with
 * `?debug` in the URL): `battle` and `field` hold each mode's world and scene, `components` every component
 * type, `ui` the HUD stores, `settings` the player's settings, `mode()` the current mode, and `encounter()`
 * starts a fight (the server only allows it in dev).
 */
import * as shared from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import * as battleComponents from "../battle/components.js";
import * as playerComponents from "../battle/player/components.js";
import * as fieldComponents from "../field/components.js";
import type { Field } from "../field/field.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import type { Mode } from "./transition.js";

interface DebugHandles {
  battle: Battle;
  field: Field;
  ui: UiState;
  settings: Settings;
  mode: () => Mode | null;
  encounter: () => void;
}

export function exposeDebugHandles(h: DebugHandles): void {
  if (!import.meta.env.DEV && !new URLSearchParams(location.search).has("debug")) return;
  Object.assign(window, {
    battle: h.battle.ctx, field: h.field.view, mode: h.mode, ui: h.ui, settings: h.settings, encounter: h.encounter,
    components: { ...shared, ...battleComponents, ...playerComponents, ...fieldComponents },
  });
}
