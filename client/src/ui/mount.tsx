import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import type { UiActions, UiSettings, UiState } from "./state.js";
import "./styles.css";

export function mountUi(container: HTMLElement, ui: UiState, settings: UiSettings, actions: UiActions): void {
  createRoot(container).render(
    <StrictMode>
      <App ui={ui} settings={settings} actions={actions} />
    </StrictMode>,
  );
}
