import type { Look, NpcId } from "@infinite-tower/shared";
import { hollisLook } from "./hollis/look.js";

export interface NpcLook {
  name: string;
  look: Look;
}

export const NPC_LOOKS: Record<NpcId, NpcLook> = {
  hollis: hollisLook,
};
