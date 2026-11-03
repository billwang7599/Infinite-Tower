import { Play, Square } from "lucide";
import { button, checkbox, el, withIcon } from "../dom.js";
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
  const row = el("div", "flex flex-wrap items-center gap-3");
  const fps = el("input", "field w-12 text-right");
  fps.type = "number";
  fps.min = "1";
  fps.max = String(MAX_FPS);
  fps.value = String(ed.project.fps);
  fps.onchange = () => ed.edit(() => { ed.project.fps = Math.max(1, Math.min(MAX_FPS, Math.round(Number(fps.value) || 1))); });
  const rate = el("label", "flex items-center gap-1.5 text-fg-muted");
  rate.append(fps, "fps");
  row.append(
    withIcon(button(playback.playing ? "Stop" : "Play", () => {
      playback.playing = !playback.playing;
      playback.startMs = performance.now();
      ed.changed();
    }, "Plays in the preview", "btn btn-primary w-20"), playback.playing ? Square : Play),
    rate,
    checkbox("Onion skin", view.onion, (on) => { view.onion = on; ed.changed(false); },
      "The frames before and after, faint"),
  );
  return row;
}
