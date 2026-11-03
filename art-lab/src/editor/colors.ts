import { el } from "../dom.js";
import { hexToRgba, rgbaToHex } from "./bitmap.js";
import { PALETTE_GROUPS } from "./palette.js";
import type { Editor } from "./state.js";

export function colors(ed: Editor): HTMLElement {
  const box = el("div", "flex flex-col gap-3");
  const hex = rgbaToHex(ed.color);
  const current = el("div", "flex items-center gap-2");
  const picker = el("input", "color-well");
  picker.type = "color";
  picker.value = hex;
  picker.dataset.tip = "Any color";
  picker.onchange = () => { ed.color = hexToRgba(picker.value); ed.changed(); };
  const text = el("input", "field w-24 font-mono uppercase");
  text.value = hex;
  text.onchange = () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) ed.color = hexToRgba(text.value.toLowerCase());
    ed.changed();
  };
  current.append(picker, text, el("span", "text-label text-fg-faint", "or a ramp from the game:"));
  box.append(current);

  for (const [group, ramps] of PALETTE_GROUPS) {
    const row = el("div", "flex flex-col gap-1");
    row.append(el("span", "text-label text-fg-muted", group));
    const strips = el("div", "flex flex-wrap gap-1.5");
    for (const [name, ramp] of Object.entries(ramps)) {
      const strip = el("div", "flex overflow-hidden rounded-[3px] ring-1 ring-black/40");
      strip.dataset.tip = name;
      for (const tone of ramp) {
        const swatch = el("div", "size-3.5 cursor-pointer hover:scale-125 hover:rounded-[2px]" +
          (tone === hex ? " relative z-10 outline-2 -outline-offset-2 outline-white" : ""));
        swatch.style.background = tone;
        swatch.dataset.tip = `${name} ${tone}`;
        swatch.onclick = () => { ed.color = hexToRgba(tone); ed.changed(); };
        strip.append(swatch);
      }
      strips.append(strip);
    }
    row.append(strips);
    box.append(row);
  }
  return box;
}
