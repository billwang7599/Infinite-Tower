import {
  clamp, itemDef, REALMS, sigilOf, smoothstep, STEP_NAMES, type CoreState, type Rarity,
} from "@infinite-tower/shared";
import {
  coreLight, fbm2, mixRamps, nearness, noise2, rampAt, REALM_LOOKS, sparksPerSec, type Color, type Lit, type Rgb,
} from "./light.js";

export const SPHERE_PX = 64;
/** The .5 keeps lone pixels off the outline's flat sides. */
const GLASS_PX = Math.floor(SPHERE_PX * 0.36) + 0.5;
export const BREAKTHROUGH = { gatherTime: 0.9, flashTime: 1, endTime: 2.8 } as const;
const BREATH_TIME = 4.2;
const SEED = 42;
const MAX_FRAME_TIME = 0.05;
const GATHER_SPARKS_PER_SEC = 120;
const FLASH_SPARKS = 46;
const NEXT_REALM_SPARKS = 0.35;
const SECOND_RAMP_SPARKS = 0.4;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const SHADES = 8;
/** In glass radii. */
const RINGS = { tiltRad: -0.32, flat: 0.27, inner: 1.1, outer: 1.4, mostGap: 0.1, widthPx: 0.8 } as const;
const RARITY_RGB: Record<Rarity, Rgb> = {
  common: [0.9, 0.88, 0.84], uncommon: [0.44, 0.81, 0.42], rare: [0.35, 0.63, 1], epic: [0.71, 0.49, 1],
  legendary: [0.94, 0.66, 0.24], unique: [1, 0.32, 0.28],
};

type SparkKind = "near" | "inward" | "burst";
interface Spark {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: Rgb; kind: SparkKind;
}

export class CoreSphere {
  steps = 0;
  nearness = 0;
  private rings: Rgb[] = [];
  private wanted: CoreState | null = null;
  private burst: { startTime: number; switched: boolean } | null = null;
  private sparks: Spark[] = [];
  private sparkDebt = 0;
  private lastTime: number | null = null;
  private readonly lit: Lit = { intensity: 0, hue: 0 };

  get bursting(): boolean {
    return this.burst !== null;
  }

  show(core: CoreState): void {
    this.wanted = core;
    if (!this.burst) this.take(core);
  }

  /** The store may already hold the new core, so the old step is at most the one before it. */
  breakthrough(time: number, core: CoreState): void {
    this.wanted = core;
    this.steps = Math.min(this.steps, core.steps - 1);
    this.burst = { startTime: time, switched: false };
  }

  private take(core: CoreState): void {
    this.steps = core.steps;
    this.nearness = nearness(core);
    this.rings = core.inscriptions.map((id) => RARITY_RGB[itemDef(sigilOf(id)).rarity]);
  }

  frame(time: number): void {
    const dt = this.lastTime === null ? 0 : clamp(time - this.lastTime, 0, MAX_FRAME_TIME);
    this.lastTime = time;
    const burst = this.burst;
    let sparksPerSecNow = sparksPerSec(this.nearness);
    if (burst) {
      const into = time - burst.startTime;
      sparksPerSecNow = into < BREAKTHROUGH.gatherTime ? GATHER_SPARKS_PER_SEC : 0;
      if (!burst.switched && into >= BREAKTHROUGH.flashTime) {
        burst.switched = true;
        if (this.wanted) this.take(this.wanted);
        this.sparks = [];
        for (let i = 0; i < FLASH_SPARKS; i++) this.spawn("burst");
      }
      if (into >= BREAKTHROUGH.endTime) {
        this.burst = null;
        if (this.wanted) this.take(this.wanted);
      }
    }
    this.sparkDebt += sparksPerSecNow * dt;
    for (; this.sparkDebt >= 1; this.sparkDebt--) this.spawn(burst ? "inward" : "near");
    if (sparksPerSecNow === 0) this.sparkDebt = 0;
    const look = REALM_LOOKS[coreLight(this.steps).realm];
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= look.sparkLift * dt;
      s.life -= dt;
      const d2 = s.x * s.x + s.y * s.y;
      if (s.kind === "inward" && d2 < 0.0025) s.life = 0;
      if (s.kind !== "burst" && d2 > 0.86 && look.halo[0] === 0) s.life = 0;
      if (d2 > 1.9) s.life = 0;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  private spawn(kind: SparkKind): void {
    const { realm, step, radius } = coreLight(this.steps);
    const look = REALM_LOOKS[realm];
    const angle = Math.random() * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle);
    const [from, speed, life]: [number, number, number] = kind === "inward"
      ? [0.75 + Math.random() * 0.15, -(0.7 + Math.random() * 0.5), 1.2]
      : kind === "burst" ? [0.05, 0.9 + Math.random() * 1.1, 0.6 + Math.random() * 0.7]
      : [radius * (0.55 + Math.random() * 0.6), 0.22 + Math.random() * 0.38, 0.45 + Math.random() * 0.8];
    const swirl = (Math.random() - 0.5) * 0.5;
    const peak = kind === "near" && step === STEP_NAMES.length - 1 && Math.random() < NEXT_REALM_SPARKS;
    const next = peak ? REALMS[REALMS.indexOf(realm) + 1] : undefined;
    const color = next ? rampAt(REALM_LOOKS[next].ramp, 0.82, [0, 0, 0])
      : rampAt(Math.random() < SECOND_RAMP_SPARKS ? look.ramp2 : look.ramp, 0.95, [0, 0, 0]);
    this.sparks.push({
      x: ca * from, y: sa * from, vx: ca * speed - sa * swirl, vy: sa * speed + ca * swirl, life, maxLife: life, color,
      kind,
    });
  }

  private view(time: number) {
    const breath = Math.sin((time / BREATH_TIME) * Math.PI * 2);
    const light = coreLight(this.steps);
    const near = smoothstep(0.82, 1, this.nearness);
    const view = { ...light, flash: 0, ringRadius: 0, ringAlpha: 0, dx: 0, dy: 0 };
    view.radius *= 1 + 0.07 * breath + near * 0.03 * (noise2(time * 14, SEED) - 0.5);
    view.brightness *= 1 + 0.1 * breath;
    if (!this.burst) return view;
    const into = time - this.burst.startTime, { gatherTime, flashTime } = BREAKTHROUGH;
    if (into < flashTime) {
      const gathered = clamp(into / gatherTime, 0, 1), shake = gathered * 1.8;
      view.radius *= 1 - 0.5 * gathered * gathered;
      view.brightness *= 1 + 0.9 * gathered;
      view.dx = Math.round((noise2(time * 30, 1) - 0.5) * shake);
      view.dy = Math.round((noise2(time * 30, 9) - 0.5) * shake);
      view.flash = into > gatherTime ? (into - gatherTime) / (flashTime - gatherTime) : 0;
    } else {
      const settling = into - flashTime;
      view.flash = Math.exp(-settling * 3.5);
      view.radius *= 1 + 0.45 * Math.exp(-settling * 2.6) * Math.cos(settling * 6);
      view.brightness *= 1 + 0.7 * Math.exp(-settling * 2.2);
    }
    if (into > gatherTime) {
      const out = into - gatherTime;
      view.ringRadius = 1 + out * 0.55;
      view.ringAlpha = Math.exp(-out * 2.2) * smoothstep(0, 0.08, out);
    }
    return view;
  }

  paint(rgba: Uint8ClampedArray, time: number): void {
    const R = GLASS_PX, half = SPHERE_PX / 2, px = 0.9 / R;
    const view = this.view(time), look = REALM_LOOKS[view.realm], halo = look.halo[view.step]!;
    const mid = mixRamps(look, 0.6, 0, [0, 0, 0]), color: Color = [0, 0, 0], lit = this.lit;
    for (let y = 0; y < SPHERE_PX; y++) {
      for (let x = 0; x < SPHERE_PX; x++) {
        const u = (x + 0.5 - half - view.dx) / R, w = (y + 0.5 - half - view.dy) / R;
        const d2 = u * u + w * w, d = Math.sqrt(d2);
        let r = 0, g = 0, b = 0, crisp = false;
        if (d <= 1) {
          const z = Math.sqrt(1 - d2);
          const turn = time * 0.04 + (1 - d) * 0.9 + SEED, cs = Math.cos(turn), sn = Math.sin(turn);
          const smoke = look.smoke
            * smoothstep(0.42, 0.78, fbm2((u * cs - w * sn) * 2.4 + SEED * 3, (u * sn + w * cs) * 2.4 + time * 0.05));
          const body = 0.03 + 0.05 * (1 - z);
          r = g = body * 0.95 + smoke * 0.07;
          b = body * 1.1 + smoke * 0.085;

          look.shape(u, w, d, time, view.radius, px, SEED, lit);
          const intensity = lit.intensity * view.brightness, strength = Math.min(1, intensity * 2);
          mixRamps(look, intensity, lit.hue, color);
          r += color[0] * strength; g += color[1] * strength; b += color[2] * strength;

          const wide = view.brightness * Math.exp(-d2 / (view.radius * view.radius * 5));
          const caught = smoke * wide * 0.6 + wide * 0.06;
          mixRamps(look, 0.55, lit.hue, color);
          r += color[0] * caught; g += color[1] * caught; b += color[2] * caught;

          // lit from the top left; the light inside is refracted onto the bottom right
          const facing = d > 0 ? clamp(0.5 - (0.5 * (u + w)) / (d * Math.SQRT2), 0, 1) : 0.5;
          const rim = smoothstep(0.74, 1, d);
          r += rim * (0.05 + 0.13 * facing); g += rim * (0.05 + 0.13 * facing); b += rim * (0.06 + 0.15 * facing);
          const caustic = smoothstep(0.6, 0.85, d) * (1 - smoothstep(0.9, 0.98, d)) * (1 - facing) ** 3
            * view.brightness * 0.55;
          r += mid[0] * caustic; g += mid[1] * caustic; b += mid[2] * caustic;

          const hx = (u + 0.4) / 0.17, hy = (w + 0.46) / 0.1, hs = hx * hx + hy * hy;
          const shine = hs < 1 ? 0.7 : hs < 2.4 ? 0.14 : 0;
          r += shine; g += shine; b += shine;
          crisp = shine > 0;

          const pu = Math.abs(u) + 1 / R, pw = Math.abs(w) + 1 / R;
          if (pu * pu + w * w > 1 || u * u + pw * pw > 1) {
            crisp = true;
            const edge = 0.12 + 0.3 * facing, inner = view.brightness * 0.18 * (1 - facing);
            r = r * 0.4 + edge + mid[0] * inner;
            g = g * 0.4 + edge + mid[1] * inner;
            b = b * 0.4 + edge * 1.08 + mid[2] * inner;
          }
          const flash = view.flash * (0.6 + 0.4 * z);
          r += flash; g += flash; b += flash;
        } else if (d < 1.5) {
          const out = d - 1;
          const glow = view.brightness * look.glow * Math.exp(-out * 16) * (0.5 + 0.5 * Math.min(1, view.radius * 2.4));
          r = mid[0] * glow; g = mid[1] * glow; b = mid[2] * glow;
          if (halo > 0) {
            const angle = Math.atan2(w, u), ringAt = 1.17 + 0.012 * Math.sin(time * 1.3);
            const ring = Math.exp(-(((d - ringAt) / 0.032) ** 2)) * (0.85 + 0.15 * Math.sin(angle * 3 + time * 0.6));
            const rays = (0.5 + 0.5 * Math.cos(angle * 16 + time * 0.08)) ** 6 * Math.exp(-out * 7) * 0.35;
            const k = halo * (ring + rays + Math.exp(-out * 6) * 0.18);
            mixRamps(look, 0.8, 0.25, color);
            r += color[0] * k; g += color[1] * k; b += color[2] * k;
          }
          if (view.ringAlpha > 0) {
            const k = Math.exp(-(((d - view.ringRadius) / 0.045) ** 2)) * view.ringAlpha;
            rampAt(look.ramp, 0.9, color);
            r += color[0] * k; g += color[1] * k; b += color[2] * k;
          }
          const flash = view.flash * Math.exp(-out * 9) * 0.8;
          r += flash; g += flash; b += flash;
        }
        if (this.rings.length > 0) {
          const ring = this.ringAt(u, w, d, time);
          if (ring.k > 0) {
            const under = 1 - ring.k * 0.85;
            r = r * under + ring.r; g = g * under + ring.g; b = b * under + ring.b;
            crisp ||= ring.k > 0.5;
          }
        }
        r = Math.min(r, 1); g = Math.min(g, 1); b = Math.min(b, 1);
        const k = shadeScale(Math.max(r, g, b), crisp ? 0.5 : BAYER[(y & 3) * 4 + (x & 3)]!) * 255;
        const i = (y * SPHERE_PX + x) * 4;
        rgba[i] = r * k; rgba[i + 1] = g * k; rgba[i + 2] = b * k; rgba[i + 3] = 255;
      }
    }
    for (const s of this.sparks) {
      const left = s.life / s.maxLife, k = left > 0.5 ? 1 : left > 0.2 ? 0.6 : 0.3;
      const sx = half + view.dx + s.x * R, sy = half + view.dy + s.y * R;
      plot(rgba, sx, sy, s.color, k);
      const trail = 0.045 * R;
      if (s.kind !== "inward" || left < 0.9) plot(rgba, sx - s.vx * trail, sy - s.vy * trail, s.color, k * 0.45);
    }
  }

  private readonly ring = { k: 0, r: 0, g: 0, b: 0 };

  private ringAt(u: number, w: number, d: number, time: number) {
    const out = this.ring, cs = Math.cos(RINGS.tiltRad), sn = Math.sin(RINGS.tiltRad);
    const a = u * cs + w * sn, c = (w * cs - u * sn) / RINGS.flat;
    out.k = out.r = out.g = out.b = 0;
    if (d <= 1 && c < 0) return out;
    const e = Math.hypot(a, c), slope = Math.hypot(a, c / RINGS.flat) / (e || 1), angle = Math.atan2(c, a);
    const n = this.rings.length, gap = n > 1 ? Math.min(RINGS.mostGap, (RINGS.outer - RINGS.inner) / (n - 1)) : 0;
    this.rings.forEach(([cr, cg, cb], i) => {
      const off = (Math.abs(e - RINGS.inner - i * gap) / slope) * GLASS_PX;
      const k = clamp(1 - off / RINGS.widthPx, 0, 1);
      if (k <= out.k) return;
      const glint = 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(angle - time * 0.7 + i * 1.3));
      out.k = k;
      out.r = cr * k * glint; out.g = cg * k * glint; out.b = cb * k * glint;
    });
    return out;
  }
}

/** Steps only the brightness, in gamma-2 space so the dark glass gets fine steps; the hue stays, unspeckled. */
function shadeScale(brightest: number, threshold: number): number {
  if (brightest <= 0) return 0;
  const shade = Math.min(SHADES, Math.floor(Math.sqrt(brightest) * SHADES + threshold)) / SHADES;
  return (shade * shade) / brightest;
}

function plot(rgba: Uint8ClampedArray, fx: number, fy: number, [r, g, b]: Rgb, k: number): void {
  const x = Math.floor(fx), y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= SPHERE_PX || y >= SPHERE_PX) return;
  const i = (y * SPHERE_PX + x) * 4;
  rgba[i] = rgba[i]! + r * 255 * k;
  rgba[i + 1] = rgba[i + 1]! + g * 255 * k;
  rgba[i + 2] = rgba[i + 2]! + b * 255 * k;
}
