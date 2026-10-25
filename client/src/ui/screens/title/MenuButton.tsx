import type { ButtonHTMLAttributes } from "react";

/** The title's big "◆ Play" / "◆ Log in" button. */
export function MenuButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "flex cursor-pointer items-center gap-3 py-1 font-title text-[28px] tracking-[0.12em] transition-opacity "
        + `duration-150 disabled:cursor-default disabled:opacity-40 ${className}`
      }
    >
      <span className="text-sm text-victory">◆</span>
      {children}
    </button>
  );
}
