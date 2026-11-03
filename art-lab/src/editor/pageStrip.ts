import { BUTTON, FIELD, button, el } from "../dom.js";
import { addPage, composite, movePage, removePage } from "./layers.js";
import { MODE_LOOKS } from "./modes.js";
import type { Editor } from "./state.js";
import { toCanvas } from "./view.js";

const THUMB_PX = 48;

export function pageStrip(ed: Editor): HTMLElement {
  const p = ed.project;
  const what = MODE_LOOKS[ed.mode].page;
  const box = el("div", "display:flex;flex-direction:column;gap:6px");
  const thumbs = el("div", "display:flex;flex-wrap:wrap;gap:6px");
  p.pages.forEach((doc, i) => {
    const c = toCanvas(composite(doc));
    const scale = Math.max(1, Math.floor(THUMB_PX / Math.max(doc.width, doc.height)));
    c.style.cssText = `width:${doc.width * scale}px;height:${doc.height * scale}px;image-rendering:pixelated;` +
      `background:#1c1d27;cursor:pointer;border:2px solid ${i === p.page ? "#c9a24a" : "#2c2e40"}`;
    c.title = doc.name || `${what} ${i + 1}`;
    c.onclick = () => ed.turnPage(i);
    thumbs.append(c);
  });
  const name = el("input", `${FIELD};width:110px`);
  name.value = ed.doc.name;
  name.placeholder = `${what} ${p.page + 1}`;
  name.onchange = () => ed.edit(() => { ed.doc.name = name.value; });
  const tools = el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center");
  tools.append(
    name,
    button(`New ${what}`, () => ed.edit(() => { p.page = addPage(p, p.page); })),
    button("Duplicate", () => ed.edit(() => {
      p.page = addPage(p, p.page, true);
      if (ed.doc.name) ed.doc.name += " copy";
    })),
    button("←", () => ed.edit(() => { p.page = movePage(p, p.page, -1); }), "Move earlier"),
    button("→", () => ed.edit(() => { p.page = movePage(p, p.page, 1); }), "Move later"),
  );
  const remove = el("button", BUTTON, "Delete");
  remove.disabled = p.pages.length === 1;
  remove.onclick = () => ed.edit(() => removePage(p, p.page));
  tools.append(remove);
  box.append(thumbs, tools);
  return box;
}
