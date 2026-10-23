/**
 * A tiny observable object: the bridge between game code and React. Calling `set` every frame is fine;
 * listeners only hear about it when a value actually changed.
 */
export class Store<T extends object> {
  private state: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  /** Don't mutate the result: change it through `set`, or listeners won't hear about it. */
  readonly get = (): T => this.state;

  /** Shallow merge. A no-op (no re-render) if every value is unchanged. */
  set(patch: Partial<T>): void {
    let changed = false;
    for (const key in patch) {
      if (!Object.is(patch[key], this.state[key])) { changed = true; break; }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Arrows (this and `get`) because useSyncExternalStore calls them unbound. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
