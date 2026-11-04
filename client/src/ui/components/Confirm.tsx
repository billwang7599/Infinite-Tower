import type { ReactNode } from "react";
import { NO_FOCUS } from "./noFocus.js";
import { BUTTON } from "./styles.js";

interface ConfirmProps {
  id: string;
  title: string;
  yes: string;
  no: string;
  answer: (yes: boolean) => void;
  /** Where it sits and its box: full class names. */
  className: string;
  top?: number;
  children?: ReactNode;
}

export function Confirm({ id, title, yes, no, answer, className, top, children }: ConfirmProps) {
  return (
    <div
      id={id} style={top === undefined ? undefined : { top }}
      className={
        "pointer-events-auto absolute left-1/2 -translate-x-1/2 cut-14 engraved text-center " + className
      }
    >
      <div className={`${children ? "mb-1" : "mb-3"} text-[15px] tracking-[0.16em] uppercase`}>{title}</div>
      {children}
      <div className="flex justify-center gap-3">
        <button
          type="button" id={`${id}-yes`} {...NO_FOCUS} className={BUTTON.primary} onClick={() => answer(true)}
        >
          {yes}
        </button>
        <button
          type="button" id={`${id}-no`} {...NO_FOCUS} className={BUTTON.plain} onClick={() => answer(false)}
        >
          {no}
        </button>
      </div>
    </div>
  );
}
