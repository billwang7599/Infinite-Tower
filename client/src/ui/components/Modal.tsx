import type { ReactNode } from "react";
import { CloseButton } from "./CloseButton.js";

interface ModalProps {
  id: string;
  title: string;
  /** A full `w-[...]` class. */
  width: string;
  close: () => void;
  children: ReactNode;
}

export function Modal({ id, title, width, close, children }: ModalProps) {
  return (
    <div
      id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
      className="fixed inset-0 flex items-center justify-center bg-black/55 font-ui text-white select-none"
    >
      <section
        className={
          `flex max-h-[min(760px,92vh)] ${width} flex-col rounded-sm border border-white/15 bg-night/95 `
          + "shadow-[0_20px_60px_#000c]"
        }
      >
        <header className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id={`${id}-title`} className="font-title text-3xl tracking-[0.08em] text-victory">{title}</h2>
          <CloseButton close={close} large />
        </header>
        {children}
      </section>
    </div>
  );
}
