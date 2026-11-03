import { NO_FOCUS } from "./noFocus.js";

export function CloseButton({ close, large = false }: { close: () => void; large?: boolean }) {
  return (
    <button
      type="button" aria-label="Close" {...NO_FOCUS} onClick={close}
      className={
        "pointer-events-auto flex cursor-pointer items-center justify-center rounded-full text-white/60 "
        + `transition-colors hover:bg-white/10 hover:text-white ${large ? "size-8 text-lg" : "size-7"}`
      }
    >
      ✕
    </button>
  );
}
