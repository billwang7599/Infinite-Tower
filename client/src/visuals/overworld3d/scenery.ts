import { inRect, type Rect } from "@infinite-tower/shared";

export type PropKind = "tree" | "pine" | "bush" | "rock" | "ruin" | "tuft" | "flowers" | "tallGrass";

export interface Prop { kind: PropKind; x: number; y: number; z: number; scale: number }

export interface Ledge { rect: Rect; topY: number }

export interface Scenery {
  /** The level's own ground first (top 0), then the ledges round it. */
  ledges: Ledge[];
  props: Prop[];
}

const TALL = new Set<PropKind>(["tree", "pine", "bush", "rock", "ruin"]);

export function isTall(kind: PropKind): boolean {
  return TALL.has(kind);
}

export function groundY(ledges: readonly Ledge[], x: number, z: number): number {
  let y = -Infinity;
  for (const l of ledges) if (inRect(l.rect, x, z) && l.topY > y) y = l.topY;
  return y === -Infinity ? 0 : y;
}
