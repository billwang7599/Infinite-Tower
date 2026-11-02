import { STATUS_DEFS, type BlessingGod, type God } from "@infinite-tower/shared";

export const GOD_NAMES: Record<God, string> = {
  valdris: "Valdris", brannoc: "Brannoc", thalor: "Thalor", aurel: "Aurel", calyx: "Calyx", haldis: "Haldis",
  kaelith: "Kaelith", ithra: "Ithra", nyra: "Nyra", morvane: "Morvane", skadrin: "Skadrin", vesk: "Vesk",
};

const percentMore = (factor: number) => `${Math.round((factor - 1) * 100)}%`;
const percentLess = (factor: number) => `${Math.round((1 - factor) * 100)}%`;
const { kaelithsEdge, brannocsAnvil, haldisHearth } = STATUS_DEFS;

export const BLESSING_TEXT: Record<BlessingGod, string> = {
  kaelith: `Kaelith's Edge, ${percentMore(kaelithsEdge.mods.damageDealtFactor)} more damage dealt.`,
  brannoc: `Brannoc's Anvil, ${percentLess(brannocsAnvil.mods.damageTakenFactor)} less damage taken and knocked back `
    + `${percentLess(brannocsAnvil.mods.knockbackFactor)} less.`,
  haldis: `Haldis's Hearth, stamina refills ${percentMore(haldisHearth.mods.staminaRegenFactor)} faster.`,
};
