import { createElement, type IconNode } from "lucide";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  e.textContent = text;
  return e;
}

export const MOD_KEY = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "") ? "⌘" : "Ctrl+";

export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

export const icon = (node: IconNode, size = 16) =>
  createElement(node, { width: size, height: size, "stroke-width": 1.75 });

export function tip(e: HTMLElement, text: string, key = ""): void {
  if (text) e.dataset.tip = text;
  if (key) e.dataset.key = key;
}

export function button(text: string, onclick: () => void, title = "", className = "btn"): HTMLButtonElement {
  const b = el("button", className, text);
  b.onclick = onclick;
  tip(b, title);
  return b;
}

export function iconButton(node: IconNode, label: string, onclick: () => void, key = "",
  className = "btn btn-ghost btn-icon"): HTMLButtonElement {
  const b = el("button", className);
  b.append(icon(node));
  b.setAttribute("aria-label", label);
  b.onclick = onclick;
  tip(b, label, key);
  return b;
}

export function withIcon<T extends HTMLElement>(e: T, node: IconNode): T {
  e.prepend(icon(node));
  return e;
}

export function select<T extends string>(options: readonly (readonly [T, string])[], value: T, onchange: (v: T) => void,
  className = "field") {
  const s = el("select", className);
  for (const [v, label] of options) s.append(new Option(label, v, false, v === value));
  s.onchange = () => onchange(s.value as T);
  return s;
}

export function checkbox(text: string, checked: boolean, onchange: (on: boolean) => void,
  title = ""): HTMLLabelElement {
  const label = el("label", "flex flex-none cursor-pointer items-center gap-2 whitespace-nowrap text-body " +
    "text-fg-muted select-none hover:text-fg");
  const box = el("input", "check");
  box.type = "checkbox";
  box.checked = checked;
  box.onchange = () => onchange(box.checked);
  label.append(box, text);
  tip(label, title);
  return label;
}

export function caption(node: HTMLElement, text: string): HTMLDivElement {
  const box = el("div", "flex flex-col items-center gap-1.5");
  box.append(node, el("span", "text-label text-fg-faint", text));
  return box;
}

const TIP_DELAY_MS = 450;
const TIP_GAP_PX = 6;

export function showTooltips(): void {
  const box = el("div", "tooltip");
  box.hidden = true;
  document.body.append(box);
  let target: HTMLElement | null = null;
  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    target = null;
    box.hidden = true;
  };
  const show = () => {
    if (!target?.isConnected) return hide();
    const key = target.dataset.key;
    box.replaceChildren(target.dataset.tip ?? "", ...(key ? [el("span", "kbd", key)] : []));
    box.hidden = false;
    const at = target.getBoundingClientRect();
    const { width, height } = box.getBoundingClientRect();
    const beside = at.left < 64;
    let x = beside ? at.right + TIP_GAP_PX : at.left + at.width / 2 - width / 2;
    let y = beside ? at.top + at.height / 2 - height / 2 : at.bottom + TIP_GAP_PX;
    if (y + height > innerHeight - 4) y = at.top - height - TIP_GAP_PX;
    x = Math.max(4, Math.min(innerWidth - width - 4, x));
    box.style.left = `${x}px`;
    box.style.top = `${Math.max(4, y)}px`;
  };
  document.addEventListener("pointerover", (e) => {
    const over = (e.target as Element).closest<HTMLElement>("[data-tip]");
    if (over === target) return;
    const quick = !box.hidden;
    hide();
    if (!over) return;
    target = over;
    timer = window.setTimeout(show, quick ? 0 : TIP_DELAY_MS);
  });
  document.addEventListener("pointerdown", hide);
  document.addEventListener("keydown", hide);
}
