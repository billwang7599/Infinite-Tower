/** The stores of the notices in the corner. Game code goes through `say`, not these. */
import { Store } from "../store.js";
import type { GameEvent } from "./say.js";

export interface Notice {
  /** Unique per notice: the React key, and what dismissing goes by (the text can repeat). */
  id: number;
  text: string;
  /** Pushed out by newer ones: it fades out, then the UI dismisses it. */
  leaving: boolean;
}

export interface NoticesState {
  /** Oldest first. */
  items: readonly Notice[];
}

export class Notifications {
  readonly notices = new Store<NoticesState>({ items: [] });
  readonly said = new Store<{ event: GameEvent | null }>({ event: null });

  /** Notices showing at once; one more and the oldest starts leaving. */
  static readonly MAX_NOTICES = 5;
  /** Notices listed, leaving ones too, so they can't pile up if nothing dismisses them. */
  private static readonly MAX_NOTICE_ROWS = 2 * Notifications.MAX_NOTICES;
  private nextNoticeId = 1;

  /** Past MAX_NOTICES the oldest showing one is marked leaving. */
  notify(text: string): void {
    const items = [...this.notices.get().items, { id: this.nextNoticeId++, text, leaving: false }];
    const showing = items.filter((n) => !n.leaving);
    const oldest = showing.length > Notifications.MAX_NOTICES ? showing[0] : undefined;
    const next = items.map((n) => (n === oldest ? { ...n, leaving: true } : n));
    this.notices.set({ items: next.slice(-Notifications.MAX_NOTICE_ROWS) });
  }

  /** Takes every notice down (leaving the world). */
  clear(): void {
    this.notices.set({ items: [] });
  }

  /** Arrows so they can be passed as props unbound. */
  readonly dismissNotice = (id: number): void => {
    this.notices.set({ items: this.notices.get().items.filter((n) => n.id !== id) });
  };
}
