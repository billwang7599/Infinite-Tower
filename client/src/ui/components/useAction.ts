import { useEffect, useEffectEvent } from "react";
import type { ActionName, Actions } from "../../core/actions.js";

export function useAction<A extends ActionName>(
  input: Actions, actions: readonly A[], handle: (action: A, repeat: boolean) => boolean | void,
): void {
  const onAction = useEffectEvent(handle);
  const listening = actions.join();
  useEffect(() => {
    const stops = (listening.split(",") as A[]).map((action) => input.on(action, (repeat) => onAction(action, repeat)));
    return () => stops.forEach((stop) => stop());
  }, [input, listening]);
}
