import { hexToRgba, type Rgba } from "./bitmap.js";
import { History } from "./history.js";
import { copyProject, newProject, projectBytes, type Doc, type Layer, type Project } from "./layers.js";
import { MODES, MODE_LOOKS, type Mode } from "./modes.js";
import type { Rect } from "./selection.js";

export const TOOL_NAMES = ["pencil", "eraser", "fill", "picker", "line", "rect", "select", "hand"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

interface Snapshot { mode: Mode; project: Project; active: number; selection: Rect | null }

const MAX_UNDO_STEPS = 100;
const MAX_UNDO_BYTES = 64 * 1024 * 1024;

const startProject = (mode: Mode) => {
  const { sizes, layers } = MODE_LOOKS[mode];
  const { width, height } = Object.values(sizes)[0]!;
  return newProject(width, height, layers);
};

export class Editor {
  mode: Mode = "sprite";
  projects = Object.fromEntries(MODES.map((m) => [m, startProject(m)])) as Record<Mode, Project>;
  active = 0;
  tool: ToolName = "pencil";
  color: Rgba = hexToRgba("#c8cbd2");
  filledRect = false;
  selection: Rect | null = null;
  private readonly history = new History<Snapshot>(
    (s) => ({ ...s, project: copyProject(s.project) }), MAX_UNDO_STEPS, (s) => projectBytes(s.project), MAX_UNDO_BYTES,
  );
  private readonly listeners = new Set<(panels: boolean) => void>();

  get project(): Project {
    return this.projects[this.mode];
  }

  get doc(): Doc {
    return this.project.pages[this.project.page]!;
  }

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

  open(mode: Mode, project: Project): void {
    this.edit(() => {
      this.mode = mode;
      this.projects[mode] = project;
      this.active = 0;
      this.selection = null;
    });
  }

  switchTo(mode: Mode): void {
    this.mode = mode;
    this.active = Math.min(this.active, this.doc.layers.length - 1);
    this.selection = null;
    this.changed();
  }

  turnPage(page: number): void {
    this.project.page = Math.max(0, Math.min(this.project.pages.length - 1, page));
    this.changed();
  }

  private snapshot(): Snapshot {
    return { mode: this.mode, project: this.project, active: this.active, selection: this.selection };
  }

  private restore(s: Snapshot | null): void {
    if (!s) return;
    this.mode = s.mode;
    this.projects[s.mode] = s.project;
    ({ active: this.active, selection: this.selection } = s);
    this.changed();
  }
}
