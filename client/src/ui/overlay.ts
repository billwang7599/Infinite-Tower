/** DOM overlays shared by both modes: the HUD containers, the encounter toast, and the fade layer. */
import type { Mode } from "../game/transition.js";

export interface Overlay {
  /** Battle HUD container (filled by battle/systems/hud.ts). */
  battleHud: HTMLElement;
  /** Field HUD container (filled by field/hud.ts). */
  fieldHud: HTMLElement;
  /** Show the HUD of the current mode. */
  setMode(mode: Mode): void;
  toast(text: string): void;
  setFade(color: string, opacity: number): void;
}

export function createOverlay(): Overlay {
  const el = (id: string) => document.getElementById(id)!;
  const battleHud = el("battle-hud"), fieldHud = el("field-hud"), toastEl = el("toast"), fade = el("fade");
  let toastTimer = 0;
  return {
    battleHud, fieldHud,
    setMode(mode) {
      battleHud.style.display = mode === "battle" ? "" : "none";
      fieldHud.style.display = mode === "field" ? "" : "none";
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.replace("opacity-0", "opacity-100");
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toastEl.classList.replace("opacity-100", "opacity-0"); }, 1800);
    },
    setFade(color, opacity) {
      fade.style.background = color;
      fade.style.opacity = String(opacity);
    },
  };
}
