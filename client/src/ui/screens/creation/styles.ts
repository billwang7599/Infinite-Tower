/** Class strings for the creation screen, which is dark on white (the rest of the UI is light on dark). */

/** The System's window and the panel: frosted white, a hairline border, a soft shadow. */
export const SHEET =
  "rounded-[3px] border border-ink/12 bg-white/80 shadow-[0_18px_50px_-20px_#23252e55] backdrop-blur-sm";

/** A small spaced-out caps label. */
export const CAPS = "text-[11px] tracking-[0.3em] text-ink/50 uppercase";

const BUTTON_BASE =
  "cursor-pointer rounded-[2px] border px-5 py-2 text-sm tracking-[0.15em] uppercase transition-colors "
  + "disabled:cursor-default disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 "
  + "focus-visible:outline-gilt";

export const BUTTON = {
  plain: `${BUTTON_BASE} border-ink/20 text-ink/70 enabled:hover:border-ink/45 enabled:hover:text-ink`,
  primary: `${BUTTON_BASE} border-gilt bg-gilt text-white enabled:hover:bg-[#93711f]`,
};
