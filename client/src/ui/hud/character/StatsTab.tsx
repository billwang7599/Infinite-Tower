import { useState } from "react";
import {
  carryLimit, coreName, coreStats, maxHpOf, moveSpeed, physicalDamage, physicalTakenFactor, placePoint, pointsLeft,
  SHOWN_STATS, skillDamage, skillTakenFactor, staminaMaxOf, takeBackPoint, type Carried, type Character,
  type CoreState, type Faith, type ShownStat, type Stats,
} from "@infinite-tower/shared";
import { EngravedFrame } from "../../components/EngravedFrame.js";
import { LookPicture } from "../../components/LookPicture.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import { RealmSeal } from "../RealmSeal.js";
import { AdvancedStats } from "./AdvancedStats.js";
import { CHART_RADIUS_PX, CHART_RINGS, chartMax, chartPoints, LABEL_RADIUS_PX } from "./chart.js";
import { STAT_TABS, type StatTab } from "./panelTabs.js";
import { Tabs } from "./Tabs.js";

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
  "pointer-events-auto size-5 cursor-pointer bg-pit/65 leading-none inset-ring inset-ring-bone/30 "
  + "enabled:hover:bg-bone/10 enabled:hover:inset-ring-cinnabar disabled:cursor-default disabled:opacity-30";

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
          {RING_SHAPES.map((ring) => <polygon key={ring} points={ring} className="fill-none stroke-bone/15" />)}
          {SPOKE_ENDS.map(([x, y], i) => (
            <line
              key={SHOWN_STATS[i]} x1={0} y1={0} x2={x} y2={y}
              className={hovered === SHOWN_STATS[i] ? "stroke-bone/50" : "stroke-bone/15"}
            />
          ))}
          <polygon
            points={shape(stats)} strokeWidth={1.5} strokeLinejoin="round" className="fill-cinnabar/20 stroke-cinnabar"
          />
          {previewStats && (
            <polygon
              id="character-chart-preview" points={shape(previewStats)} strokeWidth={1.5} strokeDasharray="3 2"
              strokeLinejoin="round" className="fill-bone/10 stroke-bone"
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
              <span className={`whitespace-nowrap ${hovered === key ? "text-bone" : "text-bone/75"}`}>
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
                <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{stats[key]}</span>
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
      <p id="character-stat-effect" className="mt-2 min-h-12 text-xs text-bone/55">
        {hovered && (
          <>
            <span className="font-semibold text-bone">{STAT_TEXT[hovered].name}</span>
            <br />
            {STAT_TEXT[hovered].effect(stats)}
            {previewStats && (
              <>
                <br />
                <span className="text-bone/85">→ {STAT_TEXT[hovered].effect(previewStats)}</span>
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
  gear: Carried;
  faith: Faith;
}

export function StatsTab({ character, core, byFire, statPoint, gear, faith }: StatsTabProps) {
  const [shown, show] = useState<StatTab>("basic");
  return (
    <div className="flex h-full flex-col">
      <Tabs id="stat-tabs" tabs={STAT_TABS} shown={shown} show={show} small />
      {shown === "basic"
        ? <BasicStats character={character} core={core} byFire={byFire} statPoint={statPoint} />
        : <AdvancedStats gear={gear} core={core} faith={faith} />}
    </div>
  );
}

function BasicStats({ character, core, byFire, statPoint }: ChartProps & { character: Character | null }) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <div className="flex w-[140px] shrink-0 flex-col gap-2">
        {character && (
          <EngravedFrame>
            <LookPicture look={character.look} view="portrait" className="block size-[140px]" />
          </EngravedFrame>
        )}
        <span className="flex items-center gap-2 text-[13px] tracking-[0.2em] uppercase">
          <RealmSeal core={core} />
          <span id="character-core">{coreName(core)}</span>
        </span>
        <span id="character-points" className="text-xs text-bone/70">
          Free points: <span className="font-semibold text-bone tabular-nums">{pointsLeft(core)}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <StatChart core={core} byFire={byFire} statPoint={statPoint} />
      </div>
    </div>
  );
}
