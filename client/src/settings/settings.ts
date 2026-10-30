/**
 * The player's settings, one store per kind, made once by main.ts. They live on the server with the save: `welcome`
 * brings them, and every change is sent back.
 */
import type { SavedSettings } from "@infinite-tower/shared";
import type { Net } from "../net/net.js";
import { AudioSettings } from "./audio.js";
import { KeyBindings } from "./bindings.js";
import { CameraSettings } from "./camera.js";
import { HudSettings } from "./hud.js";
import { MouseSettings } from "./mouse.js";

export interface Settings {
  bindings: KeyBindings;
  camera: CameraSettings;
  mouse: MouseSettings;
  hud: HudSettings;
  audio: AudioSettings;
}

/** A burst of changes (dragging the slider) goes to the server as one message. */
const SEND_AFTER_MS = 400;

export function createSettings(): Settings {
  return {
    bindings: new KeyBindings(), camera: new CameraSettings(), mouse: new MouseSettings(), hud: new HudSettings(),
    audio: new AudioSettings(),
  };
}

export function restoreSettings(settings: Settings, saved: SavedSettings): void {
  settings.bindings.restore(saved.bindings);
  settings.camera.restore(saved.camera);
  settings.mouse.restore(saved.mouse);
  settings.hud.restore(saved.hud);
  settings.audio.restore(saved.audio);
}

function toSaved(settings: Settings): SavedSettings {
  return {
    bindings: settings.bindings.toSaved(), camera: settings.camera.toSaved(), mouse: settings.mouse.toSaved(),
    hud: settings.hud.toSaved(), audio: settings.audio.toSaved(),
  };
}

/** The returned stop() sends anything still waiting. */
export function syncSettings(settings: Settings, net: Pick<Net, "send">): () => void {
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
