import { emptyEquipment, type Equipment } from "@infinite-tower/shared";

export const armed = (): Equipment => ({ ...emptyEquipment(), rightHand: "sword", leftHand: "skillbook" });
