import type { ReactNode } from "react";

interface DialogProps {
  id: string;
  /** The id of the element naming the dialog (its title). */
  titleId: string;
  /** How much the game behind is dimmed, written out in full (e.g. "bg-black/55") so Tailwind finds it. */
  dim: string;
  children: ReactNode;
}

/** A modal over the game: dims it and centers the box (styled with DIALOG_BOX, components/styles.ts). */
export function Dialog({ id, titleId, dim, children }: DialogProps) {
  return (
    <div
      id={id} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className={`fixed inset-0 flex items-center justify-center ${dim} font-ui text-white select-none`}
    >
      {children}
    </div>
  );
}
