import type { ReactNode } from "react";
import { CloseButton } from "./CloseButton.js";
import { PANEL_HEAD, PANEL_TITLE } from "./styles.js";

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
      className="fixed inset-0 flex items-center justify-center bg-black/60 text-bone select-none"
    >
      <section className={`relative flex max-h-[min(760px,92vh)] ${width} flex-col cut-14 engraved`}>
        <header className={`mx-7 mt-6 mb-2 ${PANEL_HEAD}`}>
          <h2 id={`${id}-title`} className={PANEL_TITLE}>{title}</h2>
          <CloseButton close={close} large />
        </header>
        {children}
      </section>
    </div>
  );
}
