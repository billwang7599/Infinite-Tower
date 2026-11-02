import { FIELD, button, checkbox, el } from "../dom.js";
import { MAX_FPS } from "./layers.js";
import type { Editor } from "./state.js";
import type { CanvasView } from "./view.js";

export class Playback {
  playing = false;
  startMs = 0;

  elapsedSec(nowMs: number): number {
    return (nowMs - this.startMs) / 1000;
  }
}

export function timeline(ed: Editor, view: CanvasView, playback: Playback): HTMLElement {
  const row = el("div", "display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px");
  const fps = el("input", `${FIELD};width:46px`);
  fps.type = "number";
  fps.min = "1";
  fps.max = String(MAX_FPS);
  fps.value = String(ed.project.fps);
  fps.onchange = () => ed.edit(() => { ed.project.fps = Math.max(1, Math.min(MAX_FPS, Math.round(Number(fps.value) || 1))); });
  row.append(
    button(playback.playing ? "Stop" : "Play", () => {
      playback.playing = !playback.playing;
      playback.startMs = performance.now();
      ed.changed();
    }, "Plays in the preview"),
    fps, "fps",
    checkbox("Onion skin (the frames before and after, faint)", view.onion, (on) => { view.onion = on; ed.changed(false); }),
  );
  return row;
}
