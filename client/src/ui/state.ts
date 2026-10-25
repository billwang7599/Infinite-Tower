/**
 * Everything the game tells the HTML UI. Game code writes these stores and React reads them; nothing here
 * imports React, so game code never touches it. The exceptions are `settingsScreen` and `characterScreen`: the
 * UI opens and closes them too, and the game watches them, to stop taking input while one is open. `UiActions`
 * is the other direction.
 */
import type { Character, Credentials, Inventory, ItemId, Stats } from "@infinite-tower/shared";
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
  /** The logged-in account's username, or null. */
  username: string | null;
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

export interface FieldHudState {
  levelName: string;
  wins: number;
  hpFraction: number;
  staminaFraction: number;
  /** The player's stats, for the character panel (null before `welcome`). */
  stats: Stats | null;
  /** Their name and look (null until they've made a character). */
  character: Character | null;
  /** Standing by a campfire: the Rest button shows. */
  nearCampfire: boolean;
  inventory: Inventory;
}

export interface BattleHudState {
  hpFraction: number;
  staminaFraction: number;
  enemyName: string;
  enemyHpFraction: number;
  enemyAlive: boolean;
  result: FightState;
  /** Turns on a moment after `result` is decided. */
  showResult: boolean;
}

export interface SettingsScreenState {
  open: boolean;
}

/** The character editor. `firstTime`: making the character on a first visit (it can't be closed without saving). */
export interface CharacterScreenState {
  open: boolean;
  firstTime: boolean;
}

export type SignInKind = "login" | "register";

export interface UiActions {
  /** Logs in (or makes the account), then plays. */
  signIn(kind: SignInKind, credentials: Credentials): void;
  logOut(): void;
  play(): void;
  /** Rest at the campfire you're standing by. */
  rest(): void;
  /** Use one of an item (eat the meat); the server answers with what it did. */
  useItem(item: ItemId): void;
  /** Send a new name / look to the server; the editor closes when it answers. */
  saveCharacter(character: Character): void;
  /** Leave the world: disconnects from the server. */
  returnToTitle(): void;
}

export class UiState {
  readonly title = new Store<TitleState>({ phase: "checking", error: null, username: null });
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0 });
  readonly toasts = new Store<ToastsState>({ items: [] });
  readonly settingsScreen = new Store<SettingsScreenState>({ open: false });
  readonly characterScreen = new Store<CharacterScreenState>({ open: false, firstTime: false });
  readonly field = new Store<FieldHudState>({
    levelName: "…", wins: 0, hpFraction: 1, staminaFraction: 1, stats: null, character: null, nearCampfire: false,
    inventory: {},
  });
  readonly battle = new Store<BattleHudState>({
    hpFraction: 1, staminaFraction: 1, enemyName: "", enemyHpFraction: 1, enemyAlive: false,
    result: "fighting", showResult: false,
  });

  private static readonly MAX_TOASTS = 4;
  private nextToastId = 1;

  /** Oldest goes first when there are more than MAX_TOASTS. */
  showToast(text: string): void {
    const items = [...this.toasts.get().items, { id: this.nextToastId++, text }];
    this.toasts.set({ items: items.slice(-UiState.MAX_TOASTS) });
  }

  /** Arrows so they can be passed as props unbound. */
  readonly dismissToast = (id: number): void => {
    this.toasts.set({ items: this.toasts.get().items.filter((t) => t.id !== id) });
  };

  readonly openSettings = (): void => this.settingsScreen.set({ open: true });
  readonly closeSettings = (): void => this.settingsScreen.set({ open: false });
  readonly openCharacterEditor = (): void => this.characterScreen.set({ open: true, firstTime: false });
  readonly closeCharacterEditor = (): void => {
    if (!this.characterScreen.get().firstTime) this.characterScreen.set({ open: false });
  };
}
