import { useSyncExternalStore } from "react";
import type { Store } from "./store.js";

/**
 * Read one value from a store; the component re-renders only when that value changes.
 * Select a single primitive (or a stable object): a selector that builds a new object each call
 * would re-render forever.
 */
export function useStore<T extends object, S>(store: Store<T>, select: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
