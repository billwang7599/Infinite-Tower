import { LOOKS, type LookPart } from "@infinite-tower/shared";

export const SAVE_TIMEOUT_MS = 5000;

export const PART_LABELS: Record<LookPart, string> = { cloak: "Cloak", skin: "Skin", legs: "Trousers" };

/** One color to show for an option (a cloak has several shades: its main one). */
export function swatchColor(part: LookPart, id: string): string {
  const option = (LOOKS[part] as readonly { id: string; colors: string | { base: string } }[]).find((o) => o.id === id);
  const colors = option?.colors ?? "#000";
  return typeof colors === "string" ? colors : colors.base;
}
