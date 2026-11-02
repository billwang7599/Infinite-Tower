import type { Look, NpcId } from "@infinite-tower/shared";
import { apothecaryLook } from "./apothecary/look.js";
import { corwinLook } from "./corwin/look.js";
import { grocerLook } from "./grocer/look.js";
import { heraldLook } from "./herald/look.js";
import { hollisLook } from "./hollis/look.js";
import { ilseLook } from "./ilse/look.js";
import { marenLook } from "./maren/look.js";
import { smithLook } from "./smith/look.js";
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
};
