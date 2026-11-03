export function el<K extends keyof HTMLElementTagNameMap>(tag: K, style = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = style;
  e.textContent = text;
  return e;
}

export const BUTTON = "padding:4px 10px;background:#3a3d52;color:#fff;border:1px solid #4a4e66;border-radius:3px;" +
  "cursor:pointer;font:12px system-ui,sans-serif";
export const FIELD = "background:#2a2c3a;color:#e6e6f0;border:1px solid #444;padding:3px 5px;font:12px system-ui,sans-serif";

export function button(text: string, onclick: () => void, title = ""): HTMLButtonElement {
  const b = el("button", BUTTON, text);
  b.onclick = onclick;
  b.title = title;
  return b;
}

export function select<T extends string>(options: readonly (readonly [T, string])[], value: T, onchange: (v: T) => void) {
  const s = el("select", FIELD);
  for (const [v, label] of options) s.append(new Option(label, v, false, v === value));
  s.onchange = () => onchange(s.value as T);
  return s;
}

export function checkbox(text: string, checked: boolean, onchange: (on: boolean) => void): HTMLLabelElement {
  const label = el("label", "display:flex;gap:5px;align-items:center;font-size:12px");
  const box = el("input");
  box.type = "checkbox";
  box.checked = checked;
  box.onchange = () => onchange(box.checked);
  label.append(box, text);
  return label;
}

export function caption(node: HTMLElement, text: string): HTMLDivElement {
  const box = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px");
  box.append(node, el("span", "font-size:12px;color:#9a9cb0", text));
  return box;
}
