/** Starts the React UI: the HTML layer over the game canvas, fed by the stores in `ui` (ui/state.ts). */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import type { UiState } from "./state.js";
import "./styles.css";

export function mountUi(container: HTMLElement, ui: UiState): void {
  createRoot(container).render(
    <StrictMode>
      <App ui={ui} />
    </StrictMode>,
  );
}
