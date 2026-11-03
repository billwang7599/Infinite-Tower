import { createContext, useContext } from "react";
import type { Actions } from "../core/actions.js";
import type { Settings } from "../settings/settings.js";
import type { UiActions, UiState } from "./state.js";

export interface GameUi {
  ui: UiState;
  settings: Settings;
  input: Actions;
  actions: UiActions;
}

export const GameContext = createContext<GameUi | null>(null);

export function useGame(): GameUi {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame outside the mounted UI");
  return game;
}
