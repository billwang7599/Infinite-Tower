import type { ButtonHTMLAttributes } from "react";

export function MenuButton({ className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "flex cursor-pointer items-center gap-4 bg-linear-to-r from-cinnabar/15 to-transparent to-60% py-1 pr-10 pl-1 "
        + "text-2xl font-normal tracking-[0.26em] uppercase transition-opacity duration-150 disabled:cursor-default "
        + `disabled:opacity-40 ${className}`
      }
    >
      <span className="h-[22px] w-1 bg-cinnabar" />
      {children}
    </button>
  );
}
