/**
 * The player's settings, saved in this browser: one store per kind. main.ts loads them once and hands this one
 * object to the game (which reads them every tick) and to the UI (whose settings screen edits them). A new kind
 * of setting is a store here and a section in ui/screens/settings/; nothing in between changes.
 */
import { KeyBindings } from "./bindings.js";
import { CameraSettings } from "./camera.js";

export interface Settings {
  bindings: KeyBindings;
  camera: CameraSettings;
}

export function loadSettings(): Settings {
  return { bindings: new KeyBindings(), camera: new CameraSettings() };
}
