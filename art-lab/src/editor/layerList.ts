import { FIELD, button, el } from "../dom.js";
import { addLayer, moveLayer, removeLayer } from "./layers.js";
import type { Editor } from "./state.js";

export function layerList(ed: Editor, exportLayer: (index: number) => void): HTMLElement {
  const box = el("div", "display:flex;flex-direction:column;gap:4px");
  for (let i = ed.doc.layers.length - 1; i >= 0; i--) {
    const layer = ed.doc.layers[i]!;
    const row = el("div", "display:flex;gap:4px;align-items:center;padding:3px;border-radius:3px;" +
      `background:${i === ed.active ? "#3d3420" : "#1c1d27"};border:1px solid ${i === ed.active ? "#8a6d2a" : "#2c2e40"}`);
    row.onpointerdown = (e) => {
      if (ed.active === i || !["DIV", "SPAN"].includes((e.target as HTMLElement).tagName)) return;
      ed.active = i;
      ed.changed();
    };
    const shown = el("input");
    shown.type = "checkbox";
    shown.checked = layer.visible;
    shown.title = "Show";
    shown.onchange = () => ed.edit(() => { layer.visible = shown.checked; });
    const name = el("input", `${FIELD};width:90px`);
    name.value = layer.name;
    name.onfocus = () => { if (ed.active !== i) { ed.active = i; ed.changed(); } };
    name.onchange = () => ed.edit(() => { layer.name = name.value || layer.name; });
    const opacity = el("input", "width:64px");
    opacity.type = "range";
    opacity.min = "0";
    opacity.max = "100";
    opacity.value = String(Math.round(layer.opacity * 100));
    opacity.title = "Opacity";
    opacity.onpointerdown = () => ed.record();
    const percent = el("span", "font-size:11px;color:#9a9cb0;width:30px", `${opacity.value}%`);
    opacity.oninput = () => {
      layer.opacity = Number(opacity.value) / 100;
      percent.textContent = `${opacity.value}%`;
      ed.changed(false);
    };
    row.append(
      shown, name, opacity, percent,
      button("↑", () => ed.edit(() => { ed.active = moveLayer(ed.doc, i, 1); }), "Move up"),
      button("↓", () => ed.edit(() => { ed.active = moveLayer(ed.doc, i, -1); }), "Move down"),
      button("PNG", () => exportLayer(i), "Export this layer as a PNG"),
      button("✕", () => {
        if (ed.doc.layers.length === 1) return;
        ed.edit(() => {
          removeLayer(ed.doc, i);
          ed.active = Math.min(ed.active, ed.doc.layers.length - 1);
        });
      }, "Delete"),
    );
    box.append(row);
  }
  box.append(button("Add layer", () => ed.edit(() => {
    ed.active = addLayer(ed.doc, `layer ${ed.doc.layers.length + 1}`, ed.active);
  })));
  return box;
}
