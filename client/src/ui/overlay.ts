/** DOM overlays shared by both modes: the HUD containers, the encounter toast, and the fade layer. */
import "./styles.css";

export interface Overlay {
  /** Battle HUD container (filled by the battle's hudSystem). */
  battleHud: HTMLElement;
  /** Map HUD container (filled by the overworld). */
  mapHud: HTMLElement;
  setMode(mode: "map" | "battle"): void;
  toast(text: string): void;
  setFade(color: string, opacity: number): void;
}

export function createOverlay(): Overlay {
  const el = (id: string) => document.getElementById(id)!;
  const battleHud = el("hud"), mapHud = el("maphud"), toastEl = el("toast"), fade = el("fade");
  let toastTimer = 0;
  return {
    battleHud, mapHud,
    setMode(mode) {
      battleHud.style.display = mode === "battle" ? "" : "none";
      mapHud.style.display = mode === "map" ? "" : "none";
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
