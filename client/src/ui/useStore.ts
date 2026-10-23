import { useSyncExternalStore } from "react";
import type { Store } from "./store.js";

/**
 * Re-renders only when the selected value changes. Select a primitive (or a stable object): a selector
 * that builds a new object each call re-renders forever.
 */
export function useStore<T extends object, S>(store: Store<T>, select: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
