import { useEffect, useEffectEvent } from "react";

interface KeydownOptions {
  /** Listen only while true. */
  enabled?: boolean;
  /** Capture phase: runs before every bubble-phase listener on the window, so it can stop them. */
  capture?: boolean;
}

/** A window keydown listener for as long as the component is mounted (and `enabled`). `onKey` can change freely. */
export function useKeydown(
  onKey: (e: KeyboardEvent) => void, { enabled = true, capture = false }: KeydownOptions = {},
): void {
  const handle = useEffectEvent(onKey);
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => handle(e);
    window.addEventListener("keydown", listener, capture);
    return () => window.removeEventListener("keydown", listener, capture);
  }, [enabled, capture]);
}
