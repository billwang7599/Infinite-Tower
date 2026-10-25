import type { ReactNode } from "react";

/** The full-screen layer a HUD draws in. It lets clicks through; only its buttons take them. */
export function HudLayer({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className="pointer-events-none absolute inset-0 font-ui text-base/snug font-semibold text-white text-shadow-hud"
    >
      {children}
    </div>
  );
}
