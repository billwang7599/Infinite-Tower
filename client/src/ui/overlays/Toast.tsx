import { useEffect, useState } from "react";
import type { ToastState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

const SHOW_MS = 1800;

/** A big centered message (UiState.showToast). Each new toast restarts the timer. */
export function Toast({ toast }: { toast: Store<ToastState> }) {
  const text = useStore(toast, (s) => s.text);
  const seq = useStore(toast, (s) => s.seq);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (seq === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [seq]);

  return (
    <div id="toast" className={`pointer-events-none fixed top-[22%] left-1/2 -translate-x-1/2 whitespace-nowrap font-title text-3xl tracking-wider text-white transition-opacity duration-500 text-shadow-[0_2px_8px_#000] ${visible ? "opacity-100" : "opacity-0"}`}>
      {text}
    </div>
  );
}
