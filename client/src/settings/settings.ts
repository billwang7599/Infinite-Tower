/**
 * The player's settings: one store per kind. main.ts makes them once and hands this one object to the game
 * (which reads them every tick) and to the UI (whose settings screen edits them). They live on the server with
 * the player's save: `welcome` brings them (`restoreSettings`) and, while playing, every change is sent back
 * (`syncSettings`). Before logging in they're the defaults.
 *
 * A new kind of setting is a store here (with `restore` / `toSaved`, listed in the three functions below), a
 * field in `SavedSettingsSchema` (shared/src/net/client-messages.ts), and a section in ui/screens/settings/.
 */
import type { SavedSettings } from "@infinite-tower/shared";
import type { Connection } from "../net/connection.js";
import { KeyBindings } from "./bindings.js";
import { CameraSettings } from "./camera.js";

export interface Settings {
  bindings: KeyBindings;
  camera: CameraSettings;
}

/** A burst of changes (dragging the slider) goes to the server as one message. */
const SEND_AFTER_MS = 400;

export function createSettings(): Settings {
  return { bindings: new KeyBindings(), camera: new CameraSettings() };
}

export function restoreSettings(settings: Settings, saved: SavedSettings): void {
  settings.bindings.restore(saved.bindings);
  settings.camera.restore(saved.camera);
}

function toSaved(settings: Settings): SavedSettings {
  return { bindings: settings.bindings.toSaved(), camera: settings.camera.toSaved() };
}

/** Sends the settings to the server after each change. The returned stop() sends anything still waiting. */
export function syncSettings(settings: Settings, net: Connection): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const send = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    net.send({ t: "settings", settings: toSaved(settings) });
  };
  const changed = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(send, SEND_AFTER_MS);
  };
  const unsubscribe = Object.values(settings).map((store) => store.subscribe(changed));
  return () => {
    for (const off of unsubscribe) off();
    if (timer) send();
  };
}
