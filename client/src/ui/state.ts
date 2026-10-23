/**
 * Everything the game tells the HTML UI. Game code writes these stores and React reads them; nothing here
 * imports React, so game code never touches it. The exception is `settings`: the UI opens and closes it and
 * the game watches it, to stop taking input while it's open. `UiActions` is the other direction.
 */
import type { FightState } from "../battle/context.js";
import type { Mode } from "../game/transition.js";
import { Store } from "./store.js";

export interface ScreenState {
  /** null until the game has started. */
  mode: Mode | null;
  fadeColor: string;
  fadeOpacity: number;
}

export interface TitleState {
  /**
   * menu -> connecting -> loading -> leaving (fading out over the field). A failed connection goes back to
   * menu with `error` (Play becomes Retry); anything failing after that is `failed` and needs a reload.
   */
  phase: "menu" | "connecting" | "loading" | "failed" | "leaving";
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

export interface SettingsState {
  open: boolean;
}

export interface UiActions {
  play(): void;
}

export class UiState {
  readonly title = new Store<TitleState>({ phase: "menu", error: null });
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0 });
  readonly toasts = new Store<ToastsState>({ items: [] });
  readonly settings = new Store<SettingsState>({ open: false });
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

  /** Arrows so they can be passed as props unbound. */
  readonly dismissToast = (id: number): void => {
    this.toasts.set({ items: this.toasts.get().items.filter((t) => t.id !== id) });
  };

  readonly openSettings = (): void => this.settings.set({ open: true });
  readonly closeSettings = (): void => this.settings.set({ open: false });
}
