import { useEffect, useState } from "react";
import { NO_FOCUS } from "../components/noFocus.js";
import type { ToastItem, ToastsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

const SHOW_MS = 1800;
const FADE_MS = 500;

type Dismiss = (id: number) => void;

export function Toasts({ toasts, dismiss }: { toasts: Store<ToastsState>; dismiss: Dismiss }) {
  const items = useStore(toasts, (s) => s.items);
  return (
    <div
      id="toasts"
      className="pointer-events-none absolute top-[22%] left-1/2 flex -translate-x-1/2 flex-col items-center"
    >
      {items.map((t) => (
        <Toast key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

/**
 * Fades in, holds for SHOW_MS, then fades out while its row collapses (so the ones below slide up), then
 * removes itself. The × skips straight to the fade out.
 */
function Toast({ toast, dismiss }: { toast: ToastItem; dismiss: Dismiss }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = leaving ? setTimeout(() => dismiss(toast.id), FADE_MS) : setTimeout(() => setLeaving(true), SHOW_MS);
    return () => clearTimeout(timer);
  }, [leaving, toast.id, dismiss]);

  return (
    // grid-rows 1fr -> 0fr collapses the row smoothly; starting: is the first frame, so it also fades/grows in.
    <div
      data-toast
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={`grid transition-all starting:grid-rows-[0fr] starting:opacity-0 ${
        leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
    >
      {/* overflow-hidden for the collapse; the padding keeps the text shadow from being clipped */}
      <div className="flex min-h-0 items-center gap-3 overflow-hidden px-4 pt-1 pb-2">
        <span className="whitespace-nowrap font-title text-3xl tracking-wider text-white text-shadow-[0_2px_8px_#000]">
          {toast.text}
        </span>
        <button
          type="button" aria-label="Dismiss" {...NO_FOCUS} onClick={() => setLeaving(true)}
          className={
            "pointer-events-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full "
            + "bg-black/40 font-ui text-lg/none text-white/70 transition-colors hover:bg-black/70 hover:text-white"
          }
        >
          ×
        </button>
      </div>
    </div>
  );
}
