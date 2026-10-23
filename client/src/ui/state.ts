/**
 * Everything the game tells the HTML UI. Game code only writes these stores and React only reads them;
 * nothing here imports React, so game code never touches it.
 */
import type { FightState } from "../battle/context.js";
import type { Mode } from "../game/transition.js";
import { Store } from "./store.js";

export interface ScreenState {
  /** null until the game has started. */
  mode: Mode | null;
  fadeColor: string;
  fadeOpacity: number;
  /** Startup failure only (e.g. the server is down). */
  error: string | null;
}

export interface ToastItem {
  /** Unique per toast: the React key, and what `dismissToast` removes (the text can repeat). */
  id: number;
  text: string;
}

export interface ToastsState {
  /** Oldest first. */
  items: readonly ToastItem[];
}

const MAX_TOASTS = 4;

export interface FieldHudState {
  levelName: string;
  wins: number;
}

/** Bar values are fractions 0..1. */
export interface BattleHudState {
  hp: number;
  stamina: number;
  enemyName: string;
  enemyHp: number;
  enemyAlive: boolean;
  lockOn: boolean;
  mouseCaptured: boolean;
  result: FightState;
  /** Turns on a moment after `result` is decided. */
  showResult: boolean;
}

export class UiState {
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0, error: null });
  readonly toasts = new Store<ToastsState>({ items: [] });
  readonly field = new Store<FieldHudState>({ levelName: "…", wins: 0 });
  readonly battle = new Store<BattleHudState>({
    hp: 1, stamina: 1, enemyName: "", enemyHp: 1, enemyAlive: false,
    lockOn: true, mouseCaptured: false, result: "fighting", showResult: false,
  });

  private nextToastId = 1;

  showToast(text: string): void {
    const items = [...this.toasts.get().items, { id: this.nextToastId++, text }];
    this.toasts.set({ items: items.slice(-MAX_TOASTS) });
  }

  /** An arrow so it can be passed as a prop unbound. */
  readonly dismissToast = (id: number): void => {
    this.toasts.set({ items: this.toasts.get().items.filter((t) => t.id !== id) });
  };
}
