/** Class strings shared by more than one screen or panel. */

/** Each variant sets its own colours, so no two classes fight over one property. */
const BUTTON_BASE =
  "cursor-pointer rounded-sm border px-4 py-1.5 text-sm tracking-wide transition-colors disabled:cursor-default "
  + "disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-victory";

export const BUTTON = {
  plain: `${BUTTON_BASE} border-white/20 enabled:hover:border-white/50 enabled:hover:bg-white/10`,
  primary: `${BUTTON_BASE} border-victory/60 text-victory hover:bg-victory/10`,
  danger: `${BUTTON_BASE} border-error/60 text-error hover:bg-error/10`,
};

export const TEXT_INPUT =
  "rounded-sm border border-white/20 bg-black/50 px-3 py-2 text-base text-white focus-visible:border-victory/70 "
  + "focus-visible:outline-none";
