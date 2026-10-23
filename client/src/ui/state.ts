/**
 * Everything the game tells the HTML UI. Game code (game/, field/, battle/) only writes these stores;
 * the React components in ui/ read them. Nothing here imports React, so game code never touches it.
 */
import type { FightState } from "../battle/context.js";
import type { Mode } from "../game/transition.js";
import { Store } from "./store.js";

export interface ScreenState {
  /** Which mode's HUD shows (null until the game has started). */
  mode: Mode | null;
  /** The full-screen fade/flash layer used by mode transitions. */
  fadeColor: string;
  fadeOpacity: number;
  /** A startup failure (e.g. the server is down), shown instead of the game. */
  error: string | null;
}

export interface ToastItem {
  /** Unique per toast: the React key, and what `dismissToast` removes (the text can repeat). */
  id: number;
  text: string;
}

export interface ToastsState {
  /** Oldest first. Each toast removes itself when its timer runs out or its × is clicked. */
  items: readonly ToastItem[];
}

/** Past this many on screen, the oldest is dropped so a burst can't pile up. */
const MAX_TOASTS = 4;

/** Written by field/field.ts. */
export interface FieldHudState {
  levelName: string;
  wins: number;
}

/** Written by battle/systems/hud.ts. Bar values are fractions 0..1. */
export interface BattleHudState {
  hp: number;
  stamina: number;
  enemyName: string;
  enemyHp: number;
  /** The boss bar shows while the enemy is alive. */
  enemyAlive: boolean;
  lockOn: boolean;
  mouseCaptured: boolean;
  result: FightState;
  /** The result banner is up (a moment after the fight is decided). */
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

  /** A big centered message for a few seconds (encounters, server notices). Toasts stack, oldest on top. */
  showToast(text: string): void {
    const items = [...this.toasts.get().items, { id: this.nextToastId++, text }];
    this.toasts.set({ items: items.slice(-MAX_TOASTS) });
  }

  /** Remove one toast (its timer ran out, or the player clicked its ×). An arrow so it can be passed as a prop. */
  readonly dismissToast = (id: number): void => {
    this.toasts.set({ items: this.toasts.get().items.filter((t) => t.id !== id) });
  };
}
