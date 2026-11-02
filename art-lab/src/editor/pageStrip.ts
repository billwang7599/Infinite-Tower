import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide";
import { el, iconButton } from "../dom.js";
import { addPage, composite, movePage, removePage } from "./layers.js";
import { MODE_LOOKS } from "./modes.js";
import type { Editor } from "./state.js";
import { toCanvas } from "./view.js";

const THUMB_PX = 48;

export function pageStrip(ed: Editor): HTMLElement {
  const p = ed.project;
  const what = MODE_LOOKS[ed.mode].page;
  const box = el("div", "flex flex-col gap-2.5");
  const thumbs = el("div", "flex flex-wrap gap-2");
  p.pages.forEach((doc, i) => {
    const c = toCanvas(composite(doc));
    const scale = Math.max(1, Math.floor(THUMB_PX / Math.max(doc.width, doc.height)));
    c.className = "checker pixelated cursor-pointer rounded-sm " +
      (i === p.page ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-ink-600");
    c.style.width = `${doc.width * scale}px`;
    c.style.height = `${doc.height * scale}px`;
    c.dataset.tip = doc.name || `${what} ${i + 1}`;
    c.onclick = () => ed.turnPage(i);
    const item = el("div", "flex flex-col items-center gap-1");
    item.append(c, el("span", `text-label tabular-nums ${i === p.page ? "text-fg" : "text-fg-faint"}`, String(i + 1)));
    thumbs.append(item);
  });
  const name = el("input", "field min-w-0 flex-1");
  name.value = ed.doc.name;
  name.placeholder = `${what} ${p.page + 1}`;
  name.onchange = () => ed.edit(() => { ed.doc.name = name.value; });
  const tools = el("div", "flex items-center gap-1");
  const small = "btn btn-ghost btn-icon";
  tools.append(
    name,
    iconButton(Plus, `New ${what}`, () => ed.edit(() => { p.page = addPage(p, p.page); }), "", small),
    iconButton(Copy, "Duplicate", () => ed.edit(() => {
      p.page = addPage(p, p.page, true);
      if (ed.doc.name) ed.doc.name += " copy";
    }), "", small),
    iconButton(ArrowLeft, "Move earlier", () => ed.edit(() => { p.page = movePage(p, p.page, -1); }), "", small),
    iconButton(ArrowRight, "Move later", () => ed.edit(() => { p.page = movePage(p, p.page, 1); }), "", small),
  );
  const remove = iconButton(Trash2, "Delete", () => ed.edit(() => removePage(p, p.page)), "", small);
  remove.disabled = p.pages.length === 1;
  tools.append(remove);
  box.append(thumbs, tools);
  return box;
}
