/**
 * The notices in the corner and the banner in the centre: the stores they're drawn from (Notices.tsx,
 * Announcement.tsx) and what changes them. Game code doesn't call these directly: it tells `say` (say.ts) what
 * happened, which picks the words and the place.
 */
import { Store } from "../store.js";

/** A line the game says to the player: a notice in the corner, or the banner in the centre. */
export interface Message {
  /** Unique per message: the React key, and what dismissing goes by (the text can repeat). */
  id: number;
  text: string;
}

export interface Notice extends Message {
  /** Pushed out by newer ones: it fades out, then the UI dismisses it. */
  leaving: boolean;
}

/** Small notices, bottom right: everything but a fight starting (drops, the bag, resting, eating, dying). */
export interface NoticesState {
  /** Oldest first. */
  items: readonly Notice[];
}

/** The big centre banner, kept for bigger events (a fight starting). One at a time. */
export interface AnnouncementState {
  current: Message | null;
}

export class Notifications {
  readonly notices = new Store<NoticesState>({ items: [] });
  readonly announcement = new Store<AnnouncementState>({ current: null });

  /** Notices showing at once; one more and the oldest starts leaving. */
  static readonly MAX_NOTICES = 5;
  /** Notices listed, leaving ones too, so they can't pile up if nothing dismisses them. */
  private static readonly MAX_NOTICE_ROWS = 2 * Notifications.MAX_NOTICES;
  private nextMessageId = 1;

  /** A small notice in the corner. Past MAX_NOTICES the oldest showing one is marked leaving. */
  notify(text: string): void {
    const items = [...this.notices.get().items, { id: this.nextMessageId++, text, leaving: false }];
    const showing = items.filter((n) => !n.leaving);
    const oldest = showing.length > Notifications.MAX_NOTICES ? showing[0] : undefined;
    const next = items.map((n) => (n === oldest ? { ...n, leaving: true } : n));
    this.notices.set({ items: next.slice(-Notifications.MAX_NOTICE_ROWS) });
  }

  /** The centre banner, for bigger events. A new one replaces the one up. */
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
