/**
 * A tiny observable object: the bridge between game code and React. The game calls `set` as often as it
 * likes (every frame is fine); listeners only hear about it when a value actually changed.
 * React components read it with `useStore` (ui/useStore.ts). No React in this file.
 */
export class Store<T extends object> {
  private state: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  /** The current state. Treat it as read-only: change it through `set`. */
  readonly get = (): T => this.state;

  /** Merge `patch` into the state. Does nothing (no re-render) if every value is unchanged. */
  set(patch: Partial<T>): void {
    let changed = false;
    for (const key in patch) {
      if (!Object.is(patch[key], this.state[key])) { changed = true; break; }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
