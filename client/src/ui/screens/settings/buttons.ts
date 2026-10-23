/** The settings' button styles. Each variant sets its own colours, so no two classes fight over one property. */
const BASE = "cursor-pointer rounded-sm border px-4 py-1.5 text-sm tracking-wide transition-colors disabled:cursor-default disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-victory";

export const BUTTON = {
  plain: `${BASE} border-white/20 enabled:hover:border-white/50 enabled:hover:bg-white/10`,
  primary: `${BASE} border-victory/60 text-victory hover:bg-victory/10`,
  danger: `${BASE} border-[#ff8f86]/60 text-[#ff8f86] hover:bg-[#ff8f86]/10`,
};
