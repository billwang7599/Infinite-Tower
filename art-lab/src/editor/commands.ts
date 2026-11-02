import { copyBitmap, type Bitmap } from "./bitmap.js";
import type { Command } from "./keys.js";
import { copyRect, lift, stamp } from "./selection.js";
import type { Editor } from "./state.js";
import type { CanvasView } from "./view.js";

let clipboard: { piece: Bitmap; x: number; y: number } | null = null;

export function runCommand(cmd: Command, ed: Editor, view: CanvasView, save: () => void): void {
  const sel = ed.selection;
  switch (cmd.do) {
    case "undo": return ed.undo();
    case "redo": return ed.redo();
    case "save": return save();
    case "zoom": return view.zoomBy(cmd.by);
    case "tool":
      ed.tool = cmd.tool;
      return ed.changed();
    case "selectAll":
      ed.selection = { x: 0, y: 0, w: ed.doc.width, h: ed.doc.height };
      return ed.changed();
    case "deselect":
      ed.selection = null;
      return ed.changed();
    case "underlay":
      if (ed.project.underlay) ed.project.underlay = { ...ed.project.underlay, shown: !ed.project.underlay.shown };
      return ed.changed();
    case "copy":
    case "cut":
      if (!sel) return;
      clipboard = { piece: copyRect(ed.layer.pixels, sel), ...sel };
      if (cmd.do === "cut") ed.edit(() => { lift(ed.layer.pixels, sel); });
      return;
    case "paste": {
      if (!clipboard) return;
      const { piece } = clipboard;
      const x = Math.max(0, Math.min(ed.doc.width - piece.width, clipboard.x));
      const y = Math.max(0, Math.min(ed.doc.height - piece.height, clipboard.y));
      ed.record();
      ed.floating = { layer: ed.layer, piece, under: copyBitmap(ed.layer.pixels) };
      stamp(ed.layer.pixels, piece, x, y);
      ed.selection = { x, y, w: piece.width, h: piece.height };
      ed.tool = "select";
      return ed.changed();
    }
    case "clear": {
      const floating = ed.floatingHere();
      if (sel) ed.edit(() => { floating ? ed.layer.pixels.rgba.set(floating.under.rgba) : lift(ed.layer.pixels, sel); });
      return;
    }
    case "nudge": {
      if (!sel) return;
      const { piece, under } = ed.takeSelection();
      ed.selection = { ...sel, x: sel.x + cmd.dx, y: sel.y + cmd.dy };
      ed.layer.pixels.rgba.set(under.rgba);
      stamp(ed.layer.pixels, piece, ed.selection.x, ed.selection.y);
      return ed.changed();
    }
  }
}
