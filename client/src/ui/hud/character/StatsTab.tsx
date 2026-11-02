import { useState } from "react";
import {
  carryLimit, coreName, coreStats, maxHpOf, moveSpeed, physicalDamage, physicalTakenFactor, placePoint, pointsLeft,
  SHOWN_STATS, skillDamage, skillTakenFactor, staminaMaxOf, takeBackPoint, type Character, type CoreState,
  type ShownStat, type Stats,
} from "@infinite-tower/shared";
import { LookPicture } from "../../components/LookPicture.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import { CHART_RADIUS_PX, CHART_RINGS, chartMax, chartPoints, LABEL_RADIUS_PX } from "./chart.js";

const times = (factor: number) => `×${factor.toFixed(2)}`;

const STAT_TEXT: Record<ShownStat, { name: string; short?: string; effect: (stats: Stats) => string }> = {
  strength: {
    name: "Strength",
    effect: (s) => `Physical damage ${times(physicalDamage(1, s))}, carry limit ${Math.round(carryLimit(s))}`,
  },
  agility: { name: "Agility", effect: (s) => `Walking and dodging ${times(moveSpeed(1, s))}` },
  stamina: { name: "Stamina", effect: (s) => `Stamina bar: ${staminaMaxOf(s)}` },
  skillpower: { name: "Skillpower", effect: (s) => `Skill damage ${times(skillDamage(1, s))}` },
  vitality: { name: "Vitality", effect: (s) => `HP: ${maxHpOf(s)}` },
  defense: { name: "Defense", effect: (s) => `Physical damage taken ${times(physicalTakenFactor(s))}` },
  specialDefense: {
    name: "Special defense", short: "Sp. defense",
    effect: (s) => `Skill damage taken ${times(skillTakenFactor(s))}`,
  },
};

const POINT_BUTTON =
  "pointer-events-auto size-5 cursor-pointer rounded-sm border border-white/25 leading-none "
  + "enabled:hover:border-white/60 enabled:hover:bg-white/10 disabled:cursor-default disabled:opacity-30";

const svgPoints = (points: [number, number][]) => points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const allAt = (value: number) => SHOWN_STATS.map(() => value);
const RING_SHAPES = Array.from(
  { length: CHART_RINGS }, (_, i) => svgPoints(chartPoints(allAt(i + 1), CHART_RINGS, CHART_RADIUS_PX)),
);
const SPOKE_ENDS = chartPoints(allAt(1), 1, CHART_RADIUS_PX);
const LABEL_SPOTS = chartPoints(allAt(1), 1, LABEL_RADIUS_PX);
const VIEW = CHART_RADIUS_PX + 4;
const CHART_HEIGHT_PX = 2 * (LABEL_RADIUS_PX + 38);

interface ChartProps {
  core: CoreState;
  byFire: boolean;
  statPoint: (stat: ShownStat, add: boolean) => void;
}

function StatChart({ core, byFire, statPoint }: ChartProps) {
  const [hovered, setHovered] = useState<ShownStat | null>(null);
  const [preview, setPreview] = useState<{ stat: ShownStat; add: boolean } | null>(null);
  const stats = coreStats(core), free = pointsLeft(core), max = chartMax(core);
  const previewCore = !preview ? null
    : preview.add ? placePoint(core, preview.stat)
    : byFire ? takeBackPoint(core, preview.stat) : null;
  const previewStats = previewCore && coreStats(previewCore);
  const shape = (of: Stats) => svgPoints(chartPoints(SHOWN_STATS.map((stat) => of[stat]), max, CHART_RADIUS_PX));
  return (
    <>
      <div className="relative w-full" style={{ height: CHART_HEIGHT_PX }}>
        <svg
          aria-hidden width={2 * VIEW} height={2 * VIEW} viewBox={`${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {RING_SHAPES.map((ring) => <polygon key={ring} points={ring} className="fill-none stroke-white/15" />)}
          {SPOKE_ENDS.map(([x, y], i) => (
            <line
              key={SHOWN_STATS[i]} x1={0} y1={0} x2={x} y2={y}
              className={hovered === SHOWN_STATS[i] ? "stroke-white/50" : "stroke-white/15"}
            />
          ))}
          <polygon
            points={shape(stats)} strokeWidth={1.5} strokeLinejoin="round" className="fill-victory/30 stroke-victory"
          />
          {previewStats && (
            <polygon
              id="character-chart-preview" points={shape(previewStats)} strokeWidth={1.5} strokeDasharray="3 2"
              strokeLinejoin="round" className="fill-white/10 stroke-white"
            />
          )}
        </svg>
        {SHOWN_STATS.map((key, i) => {
          const [x, y] = LABEL_SPOTS[i]!, text = STAT_TEXT[key];
          const leave = () => { setHovered(null); setPreview(null); };
          return (
            <div
              key={key} data-stat={key} onMouseEnter={() => setHovered(key)} onMouseLeave={leave}
              className="pointer-events-auto absolute flex flex-col items-center gap-0.5 px-1 text-xs"
              style={{
                left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
                transform: `translate(${-50 + (50 * x) / LABEL_RADIUS_PX}%, ${-50 + (50 * y) / LABEL_RADIUS_PX}%)`,
              }}
            >
              <span className={`whitespace-nowrap ${hovered === key ? "text-white" : "text-white/75"}`}>
                {text.short ?? text.name}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button" aria-label={`Take a point back from ${text.name}`} {...NO_FOCUS}
                  className={POINT_BUTTON} disabled={!byFire || !core.points[key]}
                  onMouseEnter={() => setPreview({ stat: key, add: false })} onMouseLeave={() => setPreview(null)}
                  onClick={() => statPoint(key, false)}
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm text-victory tabular-nums">{stats[key]}</span>
                <button
                  type="button" aria-label={`Place a point in ${text.name}`} {...NO_FOCUS}
                  className={POINT_BUTTON} disabled={free <= 0}
                  onMouseEnter={() => setPreview({ stat: key, add: true })} onMouseLeave={() => setPreview(null)}
                  onClick={() => statPoint(key, true)}
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <p id="character-stat-effect" className="mt-2 min-h-12 text-xs text-white/55">
        {hovered && (
          <>
            <span className="font-semibold text-white">{STAT_TEXT[hovered].name}</span>
            <br />
            {STAT_TEXT[hovered].effect(stats)}
            {previewStats && (
              <>
                <br />
                <span className="text-white/85">→ {STAT_TEXT[hovered].effect(previewStats)}</span>
              </>
            )}
          </>
        )}
      </p>
    </>
  );
}

interface StatsTabProps extends ChartProps {
  character: Character | null;
}

export function StatsTab({ character, core, byFire, statPoint }: StatsTabProps) {
  return (
    <div className="flex h-full gap-6">
      <div className="flex w-[140px] shrink-0 flex-col gap-2">
        {character && (
          <LookPicture
            look={character.look} view="portrait"
            className="size-[140px] rounded-sm bg-linear-to-b from-night to-black ring-1 ring-white/10"
          />
        )}
        <span id="character-core" className="font-title text-base tracking-wide text-victory">{coreName(core)}</span>
        <span id="character-points" className="text-xs text-white/70">
          Free points: <span className="font-semibold text-white tabular-nums">{pointsLeft(core)}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <StatChart core={core} byFire={byFire} statPoint={statPoint} />
      </div>
    </div>
  );
}
