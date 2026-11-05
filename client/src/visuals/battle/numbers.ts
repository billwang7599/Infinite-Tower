import { DAMAGE_TYPES, type DamageType, type Vec3 } from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";
import type { ScreenPoint } from "./overlay.js";

type Hit = Extract<FightEvent, { type: "hit" }>;

export const DAMAGE_COLOUR: Record<DamageType, string> = { slash: "#ff6a50", stab: "#ffd23f", blunt: "#7fb4ff" };
export const SKILL_COLOUR = "#f2ead8";
// Times in s; px in the HUD's CSS pixels, as AIM_HUD.
export const DAMAGE_NUMBERS = { lifeTime: 0.9, fadeTime: 0.35, risePx: 48, fontPx: 22, gapPx: 36, edgePx: 3 };

export interface DamageNumber { at: Vec3; text: string; colour: string; slot: number; slots: number; age: number }

export function damageNumbers(hit: Hit, at: Vec3): DamageNumber[] {
  const parts = hit.byType
    ? DAMAGE_TYPES.map((type) => [DAMAGE_COLOUR[type], hit.byType![type]] as const)
    : [[SKILL_COLOUR, hit.damage] as const];
  const shown = parts.map(([colour, amount]) => ({ colour, text: String(Math.round(amount * 10) / 10) }))
    .filter(({ text }) => text !== "0");
  return shown.map((part, slot) => ({ ...part, at, slot, slots: shown.length, age: 0 }));
}

export function numberLook(n: DamageNumber): { risePx: number; alpha: number } | null {
  const { lifeTime, fadeTime, risePx } = DAMAGE_NUMBERS;
  if (n.age >= lifeTime) return null;
  const share = n.age / lifeTime;
  return { risePx: risePx * (1 - (1 - share) ** 2), alpha: Math.min(1, (lifeTime - n.age) / fadeTime) };
}

export function drawNumbers(
  g: CanvasRenderingContext2D, numbers: DamageNumber[], project: (at: Vec3) => ScreenPoint | null, dt: number,
): void {
  const N = DAMAGE_NUMBERS, s = devicePixelRatio;
  g.save();
  g.font = `bold ${N.fontPx * s}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = N.edgePx * s;
  g.strokeStyle = "rgba(14, 12, 10, 0.85)";
  for (const n of numbers) {
    const look = numberLook(n), p = look && project(n.at);
    if (!look || !p) continue;
    const x = p.x + (n.slot - (n.slots - 1) / 2) * N.gapPx * s, y = p.y - look.risePx * s;
    g.globalAlpha = look.alpha;
    g.fillStyle = n.colour;
    g.strokeText(n.text, x, y);
    g.fillText(n.text, x, y);
  }
  g.restore();
  for (const n of numbers) n.age += dt;
  numbers.splice(0, numbers.length, ...numbers.filter((n) => n.age < N.lifeTime));
}
