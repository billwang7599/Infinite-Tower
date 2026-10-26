/** The box the overworld HUD's side panels (character, inventory) sit in: title, ✕, content. */
import type { ReactNode } from "react";
import { NO_FOCUS } from "../components/noFocus.js";

interface FrameProps {
  id: string;
  title: string;
  titleId?: string;
  close: () => void;
  /** In pixels, from layout.ts, which the notices also go by. */
  width: number;
  children: ReactNode;
}

export function PanelFrame({ id, title, titleId, close, width, children }: FrameProps) {
  return (
    <section
      id={id}
      aria-label={title}
      style={{ width }}
      className={
        "absolute top-14 right-4 rounded-sm border border-white/15 bg-night/90 px-5 py-4 font-normal "
        + "shadow-[0_12px_40px_#000a]"
      }
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 id={titleId} className="font-title text-xl tracking-[0.08em] text-victory">{title}</h2>
        <button
          type="button" aria-label="Close" {...NO_FOCUS} onClick={close}
          className={
            "pointer-events-auto flex size-7 cursor-pointer items-center justify-center rounded-full text-white/60 "
            + "transition-colors hover:bg-white/10 hover:text-white"
          }
        >
          ✕
        </button>
      </header>
      {children}
    </section>
  );
}
