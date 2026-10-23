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

export interface ToastState {
  text: string;
  /** Bumped by every `showToast`, so the same text twice still shows twice. */
  seq: number;
}

/** Written by field/field.ts. */
export interface FieldHudState {
  levelName: string;
  wins: number;
}

/** Written by battle/systems/hud.ts. Bar values are fractions 0..1. */
export interface BattleHudState {
  fps: number;
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
  readonly toast = new Store<ToastState>({ text: "", seq: 0 });
  readonly field = new Store<FieldHudState>({ levelName: "…", wins: 0 });
  readonly battle = new Store<BattleHudState>({
    fps: 0, hp: 1, stamina: 1, enemyName: "", enemyHp: 1, enemyAlive: false,
    lockOn: true, mouseCaptured: false, result: "fighting", showResult: false,
  });

  /** A big centered message for a moment (encounters, server notices). */
  showToast(text: string): void {
    this.toast.set({ text, seq: this.toast.get().seq + 1 });
  }
}
