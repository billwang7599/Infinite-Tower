import type { LookPart } from "@infinite-tower/shared";

export const PART_LABELS: Record<LookPart, string> = { cloak: "Cloak", skin: "Skin", legs: "Trousers" };

/** One color to show for an option (a cloak has several shades: its main one). */
export function swatchColor(colors: string | { base: string }): string {
  return typeof colors === "string" ? colors : colors.base;
}
