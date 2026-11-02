import { hexToRgba, type Rgba } from "./bitmap.js";
import { History } from "./history.js";
import { copyDoc, newDoc, type Doc, type Layer } from "./layers.js";
import type { Rect } from "./selection.js";

export const TOOL_NAMES = ["pencil", "eraser", "fill", "picker", "line", "rect", "select", "hand"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

interface Snapshot { doc: Doc; active: number; selection: Rect | null }

const MAX_UNDO_STEPS = 100;

export class Editor {
  doc: Doc = newDoc(64, 64);
  active = 0;
  tool: ToolName = "pencil";
  color: Rgba = hexToRgba("#c8cbd2");
  filledRect = false;
  selection: Rect | null = null;
  private readonly history = new History<Snapshot>(
    (s) => ({ doc: copyDoc(s.doc), active: s.active, selection: s.selection }), MAX_UNDO_STEPS,
  );
  private readonly listeners = new Set<(panels: boolean) => void>();

  get layer(): Layer {
    return this.doc.layers[this.active]!;
  }

  onChange(listener: (panels: boolean) => void): void {
    this.listeners.add(listener);
  }

  /** `panels` false: only the pixels or the view changed, so the side panels needn't be built again. */
  changed(panels = true): void {
    for (const listener of this.listeners) listener(panels);
  }

  record(): void {
    this.history.record(this.snapshot());
  }

  edit(change: () => void): void {
    this.record();
    change();
    this.changed();
  }

  undo(): void {
    this.restore(this.history.undo(this.snapshot()));
  }

  redo(): void {
    this.restore(this.history.redo(this.snapshot()));
  }

  open(doc: Doc): void {
    this.edit(() => {
      this.doc = doc;
      this.active = 0;
      this.selection = null;
    });
  }

  private snapshot(): Snapshot {
    return { doc: this.doc, active: this.active, selection: this.selection };
  }

  private restore(s: Snapshot | null): void {
    if (!s) return;
    ({ doc: this.doc, active: this.active, selection: this.selection } = s);
    this.changed();
  }
}
