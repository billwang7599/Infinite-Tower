import type { Look, NpcId } from "@infinite-tower/shared";
import { apothecaryLook } from "./apothecary/look.js";
import { bramLook } from "./bram/look.js";
import { burnerLook } from "./burner/look.js";
import { captainLook } from "./captain/look.js";
import { changerLook } from "./changer/look.js";
import { chroniclerLook } from "./chronicler/look.js";
import { cookLook } from "./cook/look.js";
import { corwinLook } from "./corwin/look.js";
import { foremanLook } from "./foreman/look.js";
import { grocerLook } from "./grocer/look.js";
import { heraldLook } from "./herald/look.js";
import { herbalistLook } from "./herbalist/look.js";
import { hollisLook } from "./hollis/look.js";
import { ilseLook } from "./ilse/look.js";
import { marenLook } from "./maren/look.js";
import { priestLook } from "./priest/look.js";
import { scavengerLook } from "./scavenger/look.js";
import { smithLook } from "./smith/look.js";
import { tamsinLook } from "./tamsin/look.js";
import { tobinLook } from "./tobin/look.js";

export interface NpcLook {
  name: string;
  look: Look;
}

export const NPC_LOOKS: Record<NpcId, NpcLook> = {
  hollis: hollisLook,
  maren: marenLook,
  tobin: tobinLook,
  corwin: corwinLook,
  ilse: ilseLook,
  herald: heraldLook,
  grocer: grocerLook,
  apothecary: apothecaryLook,
  smith: smithLook,
  changer: changerLook,
  bram: bramLook,
  captain: captainLook,
  cook: cookLook,
  tamsin: tamsinLook,
  chronicler: chroniclerLook,
  priest: priestLook,
  foreman: foremanLook,
  scavenger: scavengerLook,
  herbalist: herbalistLook,
  burner: burnerLook,
};
