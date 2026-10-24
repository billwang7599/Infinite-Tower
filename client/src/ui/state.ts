/**
 * Everything the game tells the HTML UI. Game code writes these stores and React reads them; nothing here
 * imports React, so game code never touches it. The exception is `settingsScreen`: the UI opens and closes it
 * and the game watches it, to stop taking input while it's open. `UiActions` is the other direction.
 */
import type { Credentials } from "@infinite-tower/shared";
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
   * checking (asking the server who's logged in) -> menu. In the menu, logged out shows the login form
   * (submitting it is `signingIn`, then back to menu, logged in); logged in shows Play. Play is
   * connecting -> loading -> leaving (fading out over the field). A failed connection goes back to menu with
   * `error` (Play becomes Retry); anything failing after that is `failed` and needs a reload. Return to title,
   * or losing the connection while playing, is back to menu.
   */
  phase: "checking" | "menu" | "signingIn" | "connecting" | "loading" | "failed" | "leaving";
  error: string | null;
  /** The logged-in username, or null. */
  account: string | null;
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

// Bar values (hp, stamina, enemyHp) are fractions 0..1.

export interface FieldHudState {
  levelName: string;
  wins: number;
  hp: number;
  stamina: number;
}

export interface BattleHudState {
  hp: number;
  stamina: number;
  enemyName: string;
  enemyHp: number;
  enemyAlive: boolean;
  mouseCaptured: boolean;
  result: FightState;
  /** Turns on a moment after `result` is decided. */
  showResult: boolean;
}

export interface SettingsScreenState {
  open: boolean;
}

export type SignInKind = "login" | "register";

export interface UiActions {
  /** Logs in (or makes the account), then plays. */
  signIn(kind: SignInKind, credentials: Credentials): void;
  logOut(): void;
  play(): void;
  /** Leave the world: disconnects from the server. */
  returnToTitle(): void;
}

export class UiState {
  readonly title = new Store<TitleState>({ phase: "checking", error: null, account: null });
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0 });
  readonly toasts = new Store<ToastsState>({ items: [] });
  readonly settingsScreen = new Store<SettingsScreenState>({ open: false });
  readonly field = new Store<FieldHudState>({ levelName: "…", wins: 0, hp: 1, stamina: 1 });
  readonly battle = new Store<BattleHudState>({
    hp: 1, stamina: 1, enemyName: "", enemyHp: 1, enemyAlive: false,
    mouseCaptured: false, result: "fighting", showResult: false,
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

  readonly openSettings = (): void => this.settingsScreen.set({ open: true });
  readonly closeSettings = (): void => this.settingsScreen.set({ open: false });
}
