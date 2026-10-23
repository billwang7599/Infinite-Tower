/**
 * The title screen's backdrop: a night sky, hills, and a tower that climbs out of sight into the clouds.
 * Plain SVG drawn once from a fixed seed. Nothing runs per frame; stars, windows and clouds move with
 * CSS animations (ui/styles.css), which stop under prefers-reduced-motion.
 */
import { seededRandom } from "@infinite-tower/shared";

/** viewBox size. The drift animation in styles.css moves the clouds by exactly W. */
const W = 1600, H = 900;
const TOWER_X = 1130;
const GROUND = H - 70;

const TWINKLE = "animate-twinkle motion-reduce:animate-none";

export function backdropSvg(): string {
  const rand = seededRandom(1);
  const r = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const twinkle = (period: number) =>
    `class="${TWINKLE}" style="animation-duration:${period.toFixed(2)}s;animation-delay:-${r(0, period).toFixed(2)}s"`;

  // Stars, thinning toward the horizon.
  let stars = "";
  for (let i = 0; i < 170; i++) {
    const y = H * 0.75 * rand() ** 1.6;
    const attrs = rand() < 0.3 ? twinkle(r(2.5, 6)) : "";
    stars += `<circle cx="${r(0, W).toFixed(0)}" cy="${y.toFixed(0)}" r="${r(0.6, 1.7).toFixed(2)}" fill="#fff" fill-opacity="${r(0.25, 0.95).toFixed(2)}" ${attrs}/>`;
  }

  // The tower: stacked tiers that narrow as they rise, past the top edge (it has no end).
  let tower = "", windows = "";
  let y = GROUND, width = 300, tier = 0;
  while (y > -60) {
    const h = r(62, 92), x = TOWER_X - width / 2;
    tower += `<rect x="${x.toFixed(1)}" y="${(y - h).toFixed(1)}" width="${width.toFixed(1)}" height="${h.toFixed(1)}" fill="url(#tower)"/>`;
    // A ledge on every tier, battlements on every third.
    tower += `<rect x="${(x - 10).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${(width + 20).toFixed(1)}" height="7" fill="#1f2448"/>`;
    if (tier % 3 === 2) {
      for (let bx = x - 10; bx < x + width + 4; bx += 18) tower += `<rect x="${bx.toFixed(1)}" y="${(y - h - 9).toFixed(1)}" width="10" height="9" fill="#151937"/>`;
    }
    const count = Math.max(1, Math.round(width / 70));
    for (let i = 0; i < count; i++) {
      if (rand() > 0.55) continue;
      const wx = x + (width * (i + 0.5)) / count - 4;
      const lit = rand() < 0.25 ? twinkle(r(3, 8)) : "";
      windows += `<rect x="${wx.toFixed(1)}" y="${(y - h * 0.62).toFixed(1)}" width="8" height="15" rx="4" fill="#f2c36b" fill-opacity="${r(0.55, 0.95).toFixed(2)}" ${lit}/>`;
    }
    y -= h;
    width = Math.max(110, width * 0.94);
    tier++;
  }

  // Cloud band around the upper tower, drawn twice side by side so the drift loops seamlessly.
  let clouds = "";
  for (let i = 0; i < 9; i++) {
    const cx = r(0, W), cy = r(70, 300), rx = r(180, 420), ry = r(26, 60), o = r(0.35, 0.75).toFixed(2);
    for (const dx of [0, W]) clouds += `<ellipse cx="${(cx + dx).toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="#262a4d" fill-opacity="${o}"/>`;
  }

  let fireflies = "";
  for (let i = 0; i < 22; i++) {
    fireflies += `<circle cx="${r(0, W).toFixed(0)}" cy="${r(GROUND - 40, H - 10).toFixed(0)}" r="${r(1.2, 2.4).toFixed(1)}" fill="#f6e08a" ${twinkle(r(2, 4.5))}/>`;
  }

  return `
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" class="absolute inset-0 size-full" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04050c"/><stop offset="0.5" stop-color="#10142e"/>
      <stop offset="0.82" stop-color="#29264a"/><stop offset="1" stop-color="#3c2f4c"/>
    </linearGradient>
    <linearGradient id="tower" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1b1f3c"/><stop offset="0.4" stop-color="#0e1126"/><stop offset="1" stop-color="#070816"/>
    </linearGradient>
    <linearGradient id="dissolve" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04050c"/><stop offset="1" stop-color="#04050c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c2f4c" stop-opacity="0"/><stop offset="1" stop-color="#3c2f4c" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="moon-glow">
      <stop offset="0" stop-color="#f4ead0" stop-opacity="0.3"/><stop offset="1" stop-color="#f4ead0" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}
  <circle cx="1395" cy="190" r="190" fill="url(#moon-glow)"/>
  <circle cx="1395" cy="190" r="44" fill="#efe6cc"/>
  <circle cx="1380" cy="178" r="9" fill="#d9cfb2"/><circle cx="1410" cy="205" r="6" fill="#d9cfb2"/>
  <path d="${hill(GROUND - 90, 40, 0.0035, 1.3)}" fill="#0d1024"/>
  ${tower}${windows}
  <rect width="${W}" height="240" fill="url(#dissolve)"/>
  <g filter="url(#soft)"><g class="animate-drift motion-reduce:animate-none">${clouds}</g></g>
  <rect y="${GROUND - 220}" width="${W}" height="${H - GROUND + 220}" fill="url(#mist)"/>
  <path d="${hill(GROUND, 22, 0.006, 4.1)}" fill="#05060d"/>
  ${fireflies}
</svg>`;
}

/** A hill silhouette path along `base` (two sine waves), closed down to the bottom edge. */
function hill(base: number, amp: number, freq: number, phase: number): string {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += 20) {
    const y = base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.7 + phase * 2) * amp * 0.3;
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${W} ${H} Z`;
}
