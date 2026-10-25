/**
 * The title backdrop: night sky, hills, and a tower that climbs out of sight into the clouds. Laid out once
 * from a fixed seed; stars, windows, clouds and fireflies move with CSS animations (ui/styles.css), which
 * stop under prefers-reduced-motion.
 */
import { seededRandom } from "@infinite-tower/shared";
import { memo, type CSSProperties } from "react";

/** viewBox size. The drift keyframes in styles.css move the clouds by exactly VIEW_W. */
const VIEW_W = 1600, VIEW_H = 900;
const TOWER_X = 1130;
const GROUND_Y = VIEW_H - 70;
const MOON_X = 1395, MOON_Y = 190;
const STILL_IF_REDUCED = "motion-reduce:animate-none";
const TWINKLE = `animate-twinkle ${STILL_IF_REDUCED}`;

const rand = seededRandom(1);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
/** A twinkle `duration` seconds long, at a random phase so lights don't pulse in sync. */
const twinkle = (duration: number): CSSProperties =>
  ({ animationDuration: `${duration}s`, animationDelay: `-${between(0, duration)}s` });

interface Light { x: number; y: number; opacity: number; twinkle?: CSSProperties }
/** Stars and fireflies. */
interface Dot extends Light { radius: number }
interface Tier { x: number; top: number; width: number; height: number; battlements: number[] }

// Thinning toward the horizon.
// (Each `rand()` call keeps its place: the order is the layout.)
const STARS: Dot[] = Array.from({ length: 170 }, () => {
  const y = VIEW_H * 0.75 * rand() ** 1.6;
  const tw = rand() < 0.3 ? twinkle(between(2.5, 6)) : undefined;
  return { x: between(0, VIEW_W), y, radius: between(0.6, 1.7), opacity: between(0.25, 0.95), twinkle: tw };
});

// Tiers narrow as they rise and run past the top edge: the tower has no end.
const TIERS: Tier[] = [];
const WINDOWS: Light[] = [];
for (let y = GROUND_Y, width = 300, tier = 0; y > -60; tier++) {
  const height = between(62, 92), x = TOWER_X - width / 2;
  const battlements: number[] = [];
  if (tier % 3 === 2) for (let bx = x - 10; bx < x + width + 4; bx += 18) battlements.push(bx);
  TIERS.push({ x, top: y - height, width, height, battlements });

  const count = Math.max(1, Math.round(width / 70));
  for (let i = 0; i < count; i++) {
    if (rand() > 0.55) continue;
    const tw = rand() < 0.25 ? twinkle(between(3, 8)) : undefined;
    WINDOWS.push({
      x: x + (width * (i + 0.5)) / count - 4, y: y - height * 0.62, opacity: between(0.55, 0.95), twinkle: tw,
    });
  }
  y -= height;
  width = Math.max(110, width * 0.94);
}

const CLOUDS = Array.from({ length: 9 }, () => ({
  x: between(0, VIEW_W), y: between(70, 300), rx: between(180, 420), ry: between(26, 60), opacity: between(0.35, 0.75),
}));
const FIREFLIES: Dot[] = Array.from({ length: 22 }, () => ({
  x: between(0, VIEW_W), y: between(GROUND_Y - 40, VIEW_H - 10), radius: between(1.2, 2.4), opacity: 1,
  twinkle: twinkle(between(2, 4.5)),
}));
const FAR_HILL = hill(GROUND_Y - 90, 40, 0.0035, 1.3);
const NEAR_HILL = hill(GROUND_Y, 22, 0.006, 4.1);

export const Backdrop = memo(function Backdrop() {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="title-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04050c" />
          <stop offset="0.5" stopColor="#10142e" />
          <stop offset="0.82" stopColor="#29264a" />
          <stop offset="1" stopColor="#3c2f4c" />
        </linearGradient>
        <linearGradient id="title-tower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1b1f3c" />
          <stop offset="0.4" stopColor="#0e1126" />
          <stop offset="1" stopColor="#070816" />
        </linearGradient>
        <linearGradient id="title-dissolve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04050c" />
          <stop offset="1" stopColor="#04050c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="title-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c2f4c" stopOpacity="0" />
          <stop offset="1" stopColor="#3c2f4c" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="title-moon-glow">
          <stop offset="0" stopColor="#f4ead0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f4ead0" stopOpacity="0" />
        </radialGradient>
        <filter id="title-soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <rect width={VIEW_W} height={VIEW_H} fill="url(#title-sky)" />
      {STARS.map((s, i) => <RoundLight key={i} dot={s} fill="#fff" />)}
      <circle cx={MOON_X} cy={MOON_Y} r={190} fill="url(#title-moon-glow)" />
      <circle cx={MOON_X} cy={MOON_Y} r={44} fill="#efe6cc" />
      <circle cx={MOON_X - 15} cy={MOON_Y - 12} r={9} fill="#d9cfb2" />
      <circle cx={MOON_X + 15} cy={MOON_Y + 15} r={6} fill="#d9cfb2" />
      <path d={FAR_HILL} fill="#0d1024" />

      {TIERS.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={t.top} width={t.width} height={t.height} fill="url(#title-tower)" />
          <rect x={t.x - 10} y={t.top} width={t.width + 20} height={7} fill="#1f2448" />
          {t.battlements.map((bx) => <rect key={bx} x={bx} y={t.top - 9} width={10} height={9} fill="#151937" />)}
        </g>
      ))}
      {WINDOWS.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width={8} height={15} rx={4} fill="#f2c36b" fillOpacity={w.opacity}
          className={w.twinkle ? TWINKLE : undefined} style={w.twinkle} />
      ))}

      <rect width={VIEW_W} height={240} fill="url(#title-dissolve)" />
      <g filter="url(#title-soft)">
        <g className={`animate-drift ${STILL_IF_REDUCED}`}>
          {CLOUDS.flatMap((c, i) => [0, VIEW_W].map((dx) => (
            <ellipse
              key={`${i}-${dx}`} cx={c.x + dx} cy={c.y} rx={c.rx} ry={c.ry} fill="#262a4d" fillOpacity={c.opacity}
            />
          )))}
        </g>
      </g>
      <rect y={GROUND_Y - 220} width={VIEW_W} height={VIEW_H - GROUND_Y + 220} fill="url(#title-mist)" />
      <path d={NEAR_HILL} fill="#05060d" />
      {FIREFLIES.map((f, i) => <RoundLight key={i} dot={f} fill="#f6e08a" />)}
    </svg>
  );
});

function RoundLight({ dot, fill }: { dot: Dot; fill: string }) {
  return (
    <circle cx={dot.x} cy={dot.y} r={dot.radius} fill={fill} fillOpacity={dot.opacity}
      className={dot.twinkle ? TWINKLE : undefined} style={dot.twinkle} />
  );
}

/** A hill silhouette along `base` (two sine waves), closed down to the bottom edge. */
function hill(base: number, amplitude: number, frequency: number, phase: number): string {
  let d = `M0 ${VIEW_H}`;
  for (let x = 0; x <= VIEW_W; x += 20) {
    const y = base + Math.sin(x * frequency + phase) * amplitude
      + Math.sin(x * frequency * 3.7 + phase * 2) * amplitude * 0.3;
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${VIEW_W} ${VIEW_H} Z`;
}
