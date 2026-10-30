/** The stores of the notices in the corner and the banner in the centre. Game code goes through `say`, not these. */
import { Store } from "../store.js";
import type { GameEvent } from "./say.js";

export interface Message {
  /** Unique per message: the React key, and what dismissing goes by (the text can repeat). */
  id: number;
  text: string;
}

export interface Notice extends Message {
  /** Pushed out by newer ones: it fades out, then the UI dismisses it. */
  leaving: boolean;
}

export interface NoticesState {
  /** Oldest first. */
  items: readonly Notice[];
}

export interface AnnouncementState {
  current: Message | null;
}

export class Notifications {
  readonly notices = new Store<NoticesState>({ items: [] });
  readonly announcement = new Store<AnnouncementState>({ current: null });
  readonly said = new Store<{ event: GameEvent | null }>({ event: null });

  /** Notices showing at once; one more and the oldest starts leaving. */
  static readonly MAX_NOTICES = 5;
  /** Notices listed, leaving ones too, so they can't pile up if nothing dismisses them. */
  private static readonly MAX_NOTICE_ROWS = 2 * Notifications.MAX_NOTICES;
  private nextMessageId = 1;

  /** Past MAX_NOTICES the oldest showing one is marked leaving. */
  notify(text: string): void {
    const items = [...this.notices.get().items, { id: this.nextMessageId++, text, leaving: false }];
    const showing = items.filter((n) => !n.leaving);
    const oldest = showing.length > Notifications.MAX_NOTICES ? showing[0] : undefined;
    const next = items.map((n) => (n === oldest ? { ...n, leaving: true } : n));
    this.notices.set({ items: next.slice(-Notifications.MAX_NOTICE_ROWS) });
  }

  /** A new banner replaces the one up. */
  announce(text: string): void {
    this.announcement.set({ current: { id: this.nextMessageId++, text } });
  }

  /** Takes the banner and every notice down (leaving the world). */
  clear(): void {
    this.notices.set({ items: [] });
    this.announcement.set({ current: null });
  }

  /** Arrows so they can be passed as props unbound. */
  readonly dismissNotice = (id: number): void => {
    this.notices.set({ items: this.notices.get().items.filter((n) => n.id !== id) });
  };

  /** Only if it's still the one up: a replaced banner's own timer mustn't take the new one down. */
  readonly dismissAnnouncement = (id: number): void => {
    if (this.announcement.get().current?.id === id) this.announcement.set({ current: null });
  };
}
