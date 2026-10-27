import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Actions } from "../core/actions.js";
import { App } from "./App.js";
import type { Settings } from "../settings/settings.js";
import type { UiActions, UiState } from "./state.js";
import "./styles.css";

export function mountUi(
  container: HTMLElement, ui: UiState, settings: Settings, input: Actions, actions: UiActions,
): void {
  createRoot(container).render(
    <StrictMode>
      <App ui={ui} settings={settings} input={input} actions={actions} />
    </StrictMode>,
  );
}
