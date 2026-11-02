import { FIELD, el } from "../dom.js";
import { hexToRgba, rgbaToHex } from "./bitmap.js";
import { PALETTE_GROUPS } from "./palette.js";
import type { Editor } from "./state.js";

const SWATCH_PX = 14;

export function colors(ed: Editor): HTMLElement {
  const box = el("div", "display:flex;flex-direction:column;gap:6px");
  const hex = rgbaToHex(ed.color);
  const current = el("div", "display:flex;gap:6px;align-items:center");
  const picker = el("input", "width:40px;height:26px;border:0;padding:0;background:none");
  picker.type = "color";
  picker.value = hex;
  picker.title = "Any color";
  picker.onchange = () => { ed.color = hexToRgba(picker.value); ed.changed(); };
  const text = el("input", `${FIELD};width:70px`);
  text.value = hex;
  text.onchange = () => {
    if (/^#[0-9a-f]{6}$/i.test(text.value)) ed.color = hexToRgba(text.value.toLowerCase());
    ed.changed();
  };
  current.append(picker, text, el("span", "font-size:11px;color:#9a9cb0", "or pick from the game's ramps:"));
  box.append(current);

  for (const [group, ramps] of PALETTE_GROUPS) {
    const row = el("div", "display:flex;flex-wrap:wrap;gap:6px;align-items:center");
    row.append(el("span", "font-size:11px;color:#9a9cb0;width:44px", group));
    for (const [name, ramp] of Object.entries(ramps)) {
      const strip = el("div", "display:flex");
      strip.title = name;
      for (const tone of ramp) {
        const on = tone === hex;
        const swatch = el("div", `width:${SWATCH_PX}px;height:${SWATCH_PX}px;background:${tone};cursor:pointer;` +
          (on ? "outline:2px solid #fff;outline-offset:-2px" : ""));
        swatch.title = `${name} ${tone}`;
        swatch.onclick = () => { ed.color = hexToRgba(tone); ed.changed(); };
        strip.append(swatch);
      }
      row.append(strip);
    }
    box.append(row);
  }
  return box;
}
