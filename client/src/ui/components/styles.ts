/** Class strings shared by more than one screen or panel. */

/** Each variant sets its own colours, so no two classes fight over one property. */
const BUTTON_BASE =
  "cut-6 clip-cut cursor-pointer px-4 py-[7px] text-xs font-semibold tracking-[0.22em] uppercase transition-colors "
  + "disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:inset-ring-2";

export const BUTTON = {
  plain: `${BUTTON_BASE} bg-pit/55 text-bone inset-ring inset-ring-bone/35 enabled:hover:bg-bone/10 `
    + "focus-visible:inset-ring-bone",
  primary: `${BUTTON_BASE} bg-cinnabar text-seal-ink [text-shadow:none] enabled:hover:brightness-110 `
    + "focus-visible:inset-ring-seal-ink/60",
  danger: `${BUTTON_BASE} bg-pit/55 text-error inset-ring inset-ring-error/55 enabled:hover:bg-error/10 `
    + "focus-visible:inset-ring-error",
};

export const TEXT_INPUT =
  "bg-pit/70 px-3 py-2 text-base text-bone inset-ring inset-ring-bone/25 placeholder:text-bone/40 "
  + "focus-visible:outline-none focus-visible:inset-ring-cinnabar/70";

export const PANEL_TITLE = "text-[17px]/6 font-semibold tracking-[0.3em] text-bone uppercase text-shadow-letterpress";
export const PANEL_HEAD = "flex items-center justify-between pb-2 shadow-[0_1px_0_#e8dfc855,0_2px_0_#0008]";

export const WELL = "bg-pit/65 inset-ring inset-ring-bone/22 inset-shadow-[0_2px_6px_#000]";

export const LABEL = "text-[11px] font-semibold tracking-[0.26em] text-verdigris uppercase";
