import {
  EMBERS, FIRST_DOOR, INSCRIPTIONS, itemDef, sigilOf, STATUS_DEFS, type InscriptionId, type Rarity,
} from "@infinite-tower/shared";

const { strength, vitality } = INSCRIPTIONS.grit.stats;
const percent = (share: number) => `${Math.round(share * 100)}%`;

export const INSCRIPTION_TEXT: Record<InscriptionId, string> = {
  grit: `+${strength} strength and +${vitality} vitality.`,
  embers: `Always aflame: burning never hurts you, and your weapon hits set foes burning, `
    + `${STATUS_DEFS.embers.mods.weaponBurnPerSec} a second for ${EMBERS.burnTime} s.`,
  "last-breath": `Swing and dodge on empty: each point of stamina you lack costs `
    + `${STATUS_DEFS.lastBreath.mods.hpPerStaminaShort} HP, never your last.`,
  "red-blade": `Your weapon hits heal you ${percent(STATUS_DEFS.redBlade.mods.weaponLifesteal)} of the damage `
    + "they deal.",
  "first-door": `Once a fight, a killing blow leaves you at ${FIRST_DOOR.hpLeft} HP, untouchable for `
    + `${FIRST_DOOR.openTime} s.`,
};

export const inscriptionName = (id: InscriptionId): string =>
  itemDef(sigilOf(id)).name.replace(/^Sigil of (the )?/, "");

export const inscriptionRarity = (id: InscriptionId): Rarity => itemDef(sigilOf(id)).rarity;
