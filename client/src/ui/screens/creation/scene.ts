/**
 * The creation scene's steps (CreationScreen.tsx plays them), as a pure reducer:
 *
 *   greet     the System's greeting, a line at a time (lines.ts); advancing past the last opens the panel
 *   make      the panel: a name, boy or girl, a look. Begin asks to confirm
 *   confirm   "Is this you?" Yes sends it to the server; Not yet goes back to the panel
 *   saving    waiting for the server to save it; no answer in time goes back to the panel, with an error
 *   farewell  the System's last line
 *   out       the white clears off the world; then the screen closes
 */
import { GREETING, SAVE_FAILED } from "./lines.js";

type Step = "greet" | "make" | "confirm" | "saving" | "farewell" | "out";

export interface Scene {
  step: Step;
  /** The greeting's line, while greeting. */
  line: number;
  /** Why the last try didn't work, shown on the panel. */
  error: string | null;
}

export type SceneEvent =
  | { type: "advance" }
  | { type: "begin" }
  | { type: "answer"; yes: boolean }
  | { type: "saved" }
  | { type: "timedOut" };

export const START: Scene = { step: "greet", line: 0, error: null };

/** Anything that doesn't fit the step (a stray key, a late answer) changes nothing. */
export function nextScene(scene: Scene, event: SceneEvent): Scene {
  switch (scene.step) {
    case "greet":
      if (event.type !== "advance") return scene;
      return scene.line + 1 < GREETING.length ? { ...scene, line: scene.line + 1 } : { ...scene, step: "make" };
    case "make":
      return event.type === "begin" ? { ...scene, step: "confirm", error: null } : scene;
    case "confirm":
      return event.type === "answer" ? { ...scene, step: event.yes ? "saving" : "make" } : scene;
    case "saving":
      if (event.type === "saved") return { ...scene, step: "farewell" };
      if (event.type === "timedOut") return { ...scene, step: "make", error: SAVE_FAILED };
      return scene;
    case "farewell":
      return event.type === "advance" ? { ...scene, step: "out" } : scene;
    case "out":
      return scene;
  }
}
