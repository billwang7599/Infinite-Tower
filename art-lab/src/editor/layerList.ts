import { ArrowDown, ArrowUp, Eye, EyeOff, ImageDown, Plus, Trash2 } from "lucide";
import { button, el, iconButton, withIcon } from "../dom.js";
import { addLayer, moveLayer, removeLayer, setLayer } from "./layers.js";
import type { Editor } from "./state.js";

const ROW_BUTTON = "btn btn-ghost btn-icon btn-sm";

export function layerList(ed: Editor, exportLayer: (index: number) => void): HTMLElement {
  const box = el("div", "flex flex-col gap-1");
  for (let i = ed.doc.layers.length - 1; i >= 0; i--) {
    const layer = ed.doc.layers[i]!;
    const row = el("div", "flex items-center gap-1 rounded-md border px-1 py-1 " +
      (i === ed.active ? "border-accent/50 bg-accent-soft" : "border-transparent bg-ink-850 hover:bg-ink-800"));
    row.onpointerdown = (e) => {
      if (ed.active === i || !["DIV", "SPAN"].includes((e.target as HTMLElement).tagName)) return;
      ed.active = i;
      ed.changed();
    };
    const shown = iconButton(layer.visible ? Eye : EyeOff, layer.visible ? "Hide" : "Show",
      () => ed.edit(() => setLayer(ed.project, i, { visible: !layer.visible })), "", ROW_BUTTON);
    if (!layer.visible) shown.classList.add("opacity-60");
    const name = el("input", `field field-quiet h-6 flex-1 px-1.5 ${layer.visible ? "" : "text-fg-faint"}`);
    name.value = layer.name;
    name.onfocus = () => { if (ed.active !== i) { ed.active = i; ed.changed(); } };
    name.onchange = () => ed.edit(() => setLayer(ed.project, i, { name: name.value || layer.name }));
    const opacity = el("input", "range w-14 flex-none");
    opacity.type = "range";
    opacity.min = "0";
    opacity.max = "100";
    opacity.value = String(Math.round(layer.opacity * 100));
    opacity.dataset.tip = "Opacity";
    opacity.onpointerdown = () => ed.record();
    const percent = el("span", "w-8 flex-none text-right text-label text-fg-muted tabular-nums", `${opacity.value}%`);
    opacity.oninput = () => {
      setLayer(ed.project, i, { opacity: Number(opacity.value) / 100 });
      percent.textContent = `${opacity.value}%`;
      ed.changed(false);
    };
    row.append(
      shown, name, opacity, percent,
      iconButton(ArrowUp, "Move up", () => ed.edit(() => { ed.active = moveLayer(ed.project, i, 1); }), "", ROW_BUTTON),
      iconButton(ArrowDown, "Move down", () => ed.edit(() => { ed.active = moveLayer(ed.project, i, -1); }), "",
        ROW_BUTTON),
      iconButton(ImageDown, "Export this layer as a PNG", () => exportLayer(i), "", ROW_BUTTON),
      iconButton(Trash2, "Delete", () => {
        if (ed.doc.layers.length === 1) return;
        ed.edit(() => {
          removeLayer(ed.project, i);
          ed.active = Math.min(ed.active, ed.doc.layers.length - 1);
        });
      }, "", ROW_BUTTON),
    );
    box.append(row);
  }
  box.append(withIcon(button("Add layer", () => ed.edit(() => {
    ed.active = addLayer(ed.project, `layer ${ed.doc.layers.length + 1}`, ed.active);
  }), "", "btn btn-ghost mt-1 w-full border-dashed border-ink-600"), Plus));
  return box;
}
