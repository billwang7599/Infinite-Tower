import type { Look, NpcId } from "@infinite-tower/shared";
import { corwinLook } from "./corwin/look.js";
import { hollisLook } from "./hollis/look.js";
import { ilseLook } from "./ilse/look.js";
import { marenLook } from "./maren/look.js";
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
};
