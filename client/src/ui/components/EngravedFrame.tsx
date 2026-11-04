import type { ReactNode } from "react";

// Drawn over the picture: a canvas would hide an inset shadow.
const LINES =
  "pointer-events-none absolute inset-0 transition-shadow "
  + "shadow-[inset_0_0_0_1px_#e8dfc899,inset_0_0_0_4px_#16171b,inset_0_0_0_5px_#e8dfc844] "
  + "group-hover:shadow-[inset_0_0_0_1px_#e8dfc8,inset_0_0_0_4px_#16171b,inset_0_0_0_5px_#e8dfc866]";

export function EngravedFrame({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`relative cut-12 clip-cut bg-stone ${className}`}>
      {children}
      <div className={LINES} />
    </div>
  );
}
