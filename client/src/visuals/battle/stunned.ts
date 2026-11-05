import { Body, type World } from "@infinite-tower/shared";
import { insideSelf } from "../../modes/battle/camera.js";
import { STUN_CUE, type Stun } from "../../modes/battle/stun.js";
import { LocalPlayer } from "../../modes/components.js";
import type { ArenaScene } from "./scene.js";

// In the HUD's CSS pixels, as AIM_HUD.
export const STUN_HUD = {
  orbitDownShare: 0.19, orbitXPx: 150, orbitYPx: 30, starPx: 20, farScale: 0.55, innerShare: 0.45, fewestStars: 3,
  mostStars: 5, orbitRadPerSec: 3.2, spinRadPerSec: 2.5, popTime: 0.12, vignetteAlpha: 0.5, vignetteInnerShare: 0.45,
};
const NEAR_RGB = [255, 216, 74] as const;
const FAR_RGB = [196, 150, 52] as const;
const STAR_EDGE = "rgba(48, 32, 10, 0.85)";
const STAR_GLOW = "rgba(255, 224, 130, 0.7)";
const VIGNETTE_RGB = "24, 16, 40";

export interface StunStar { x: number; y: number; radiusPx: number; alpha: number; spinRad: number; near: number }

export function stunStars(
  stun: Stun, firstPerson: boolean, widthPx: number, heightPx: number, scale: number,
): StunStar[] {
  if (!firstPerson || stun.shown <= 0) return [];
  const H = STUN_HUD, longShare = (stun.strength - STUN_CUE.minStrength) / (1 - STUN_CUE.minStrength);
  const count = Math.round(H.fewestStars + (H.mostStars - H.fewestStars) * longShare);
  const popped = 1 - (1 - Math.min(1, stun.age / H.popTime)) ** 2;
  const sizePx = H.starPx * scale * (0.8 + 0.2 * stun.strength) * (0.5 + 0.5 * popped) * (0.6 + 0.4 * stun.shown);
  const stars = Array.from({ length: count }, (_, k): StunStar => {
    const a = stun.age * H.orbitRadPerSec + (k * 2 * Math.PI) / count, near = (Math.sin(a) + 1) / 2;
    return {
      x: widthPx / 2 + Math.cos(a) * H.orbitXPx * scale,
      y: heightPx * H.orbitDownShare + Math.sin(a) * H.orbitYPx * scale,
      radiusPx: sizePx * (H.farScale + (1 - H.farScale) * near), alpha: stun.shown,
      spinRad: stun.age * H.spinRadPerSec + k, near,
    };
  });
  return stars.sort((s1, s2) => s1.y - s2.y);
}

export const vignetteAlpha = (stun: Stun): number => STUN_HUD.vignetteAlpha * stun.strength * stun.shown;

export function drawStun(
  g: CanvasRenderingContext2D, ctx: ArenaScene, world: World, widthPx: number, heightPx: number,
): void {
  const stun = ctx.battle.stun, me = world.first(LocalPlayer, Body);
  if (!me || stun.shown <= 0) return;
  const shade = vignetteAlpha(stun), halfDiagonal = Math.hypot(widthPx, heightPx) / 2;
  const vignette = g.createRadialGradient(
    widthPx / 2, heightPx / 2, halfDiagonal * STUN_HUD.vignetteInnerShare, widthPx / 2, heightPx / 2, halfDiagonal,
  );
  vignette.addColorStop(0, `rgba(${VIGNETTE_RGB}, 0)`);
  vignette.addColorStop(1, `rgba(${VIGNETTE_RGB}, ${shade})`);
  g.fillStyle = vignette;
  g.fillRect(0, 0, widthPx, heightPx);
  const firstPerson = insideSelf(ctx.battle.view.eye, me[2].pos), s = devicePixelRatio;
  g.save();
  g.strokeStyle = STAR_EDGE;
  g.lineWidth = 1.5 * s;
  g.lineJoin = "round";
  g.shadowColor = STAR_GLOW;
  g.shadowBlur = 6 * s;
  for (const star of stunStars(stun, firstPerson, widthPx, heightPx, s)) {
    const rgb = NEAR_RGB.map((c, i) => Math.round(FAR_RGB[i]! + (c - FAR_RGB[i]!) * star.near));
    g.globalAlpha = star.alpha;
    g.fillStyle = `rgb(${rgb.join(", ")})`;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? star.radiusPx : star.radiusPx * STUN_HUD.innerShare;
      const a = star.spinRad + (i * Math.PI) / 5 - Math.PI / 2;
      g.lineTo(star.x + Math.cos(a) * r, star.y + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.restore();
}
