import { NO_FOCUS } from "../components/noFocus.js";

/** A notice's ×: the only part of a notice that takes clicks. (The centre banner has none.) */
export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button" aria-label="Dismiss" {...NO_FOCUS} onClick={onClick}
      className={
        "pointer-events-auto flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/40 "
        + "font-ui text-sm/none text-white/70 transition-colors hover:bg-black/70 hover:text-white"
      }
    >
      ×
    </button>
  );
}
