import type { CoreState } from "@infinite-tower/shared";
import { coreLight, REALM_LOOKS } from "../../gfx/core/light.js";

const BASE = "inline-grid shrink-0 place-items-center font-seal font-semibold tracking-normal [text-shadow:none]";
const SIZE = {
  small: "size-[17px] rounded-[2px] text-[11px]/none",
  big: "size-[30px] rounded-[3px] text-[19px]/none",
};
const INK = {
  solid: "bg-cinnabar text-seal-ink inset-ring inset-ring-black/25",
  hollow: "text-cinnabar inset-ring inset-ring-cinnabar",
};

interface SealProps {
  core: CoreState | null;
  size?: keyof typeof SIZE;
  hollow?: boolean;
}

export function RealmSeal({ core, size = "small", hollow = false }: SealProps) {
  const glyph = core ? REALM_LOOKS[coreLight(core.steps).realm].glyph : "";
  if (!glyph) return null;
  return <span aria-hidden className={`${BASE} ${SIZE[size]} ${INK[hollow ? "hollow" : "solid"]}`}>{glyph}</span>;
}
