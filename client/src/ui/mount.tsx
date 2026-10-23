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
