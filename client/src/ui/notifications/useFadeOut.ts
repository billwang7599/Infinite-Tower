import { useEffect, useState } from "react";

/**
 * A message's life on screen: it holds for `holdMs`, then is `leaving` (fading out) for `fadeMs`, then dismissed.
 * `leave()` (a notice's ×) and `pushedOut` (newer ones took its place) skip the hold. `dismiss` must be stable.
 */
export function useFadeOut(
  id: number, dismiss: (id: number) => void, holdMs: number, fadeMs: number, pushedOut = false,
) {
  const [timedOut, setTimedOut] = useState(false);
  const leaving = pushedOut || timedOut;

  useEffect(() => {
    const timer = leaving ? setTimeout(() => dismiss(id), fadeMs) : setTimeout(() => setTimedOut(true), holdMs);
    return () => clearTimeout(timer);
  }, [leaving, id, dismiss, holdMs, fadeMs]);

  return { leaving, leave: () => setTimedOut(true) };
}
