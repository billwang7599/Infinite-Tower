import { useState } from "react";
import {
  BLESSING_FAITH, blessingsOf, carryLimit, coreName, coreStats, GODS, inscriptionSlots, maxHpOf, moveSpeed,
  physicalDamage, physicalTakenFactor, placePoint, pointsLeft, SHOWN_STATS, skillDamage, skillTakenFactor,
  staminaMaxOf, takeBackPoint, type CoreState, type Faith, type ShownStat, type Stats,
} from "@infinite-tower/shared";
import { LookPicture } from "../../components/LookPicture.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import type { OverworldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { BLESSING_TEXT, GOD_NAMES } from "../blessings.js";
import { INSCRIPTION_TEXT, inscriptionName, inscriptionRarity } from "../inscriptions.js";
import { RARITY_TEXT } from "../inventory/itemInfo.js";
import { PanelFrame } from "../PanelFrame.js";
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
      <div className="relative h-[228px] w-full">
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

interface PanelProps {
  hud: Store<OverworldHudState>;
  statPoint: (stat: ShownStat, add: boolean) => void;
  close: () => void;
  shownWidth: (px: number) => void;
}

const WIDTH_PX = 336;

export function CharacterPanel({ hud, statPoint, close, shownWidth }: PanelProps) {
  const core = useStore(hud, (s) => s.core);
  const byFire = useStore(hud, (s) => s.byFire);
  const character = useStore(hud, (s) => s.character);
  const faith = useStore(hud, (s) => s.faith);
  return (
    <PanelFrame
      id="character-panel" title={character?.name ?? "Character"} titleId="character-name"
      width={WIDTH_PX} shownWidth={shownWidth} close={close}
    >
      {character && (
        <LookPicture
          look={character.look} view="portrait"
          className="mx-auto -mt-1 mb-3 size-[128px] border-b border-white/10"
        />
      )}
      {core && (
        <>
          <div className="flex items-baseline justify-between">
            <span id="character-core" className="font-title text-base tracking-wide text-victory">
              {coreName(core)}
            </span>
            <span id="character-points" className="text-xs text-white/70">
              Free points: <span className="font-semibold text-white tabular-nums">{pointsLeft(core)}</span>
            </span>
          </div>
          <StatChart core={core} byFire={byFire} statPoint={statPoint} />
          <Rings core={core} />
          <FaithList faith={faith} />
        </>
      )}
    </PanelFrame>
  );
}

function Rings({ core }: { core: CoreState }) {
  return (
    <section id="character-rings" className="mt-1 border-t border-white/10 pt-2 text-xs">
      <div className="flex items-baseline justify-between text-white/70">
        <span className="tracking-[0.12em] uppercase">Rings</span>
        <span className="tabular-nums">{core.inscriptions.length} / {inscriptionSlots(core)}</span>
      </div>
      {core.inscriptions.length === 0 && (
        <p className="mt-1 text-white/45 italic">Nothing carved yet. The Collegium carves sigils into a core.</p>
      )}
      <ul className="mt-1 flex flex-col gap-1">
        {core.inscriptions.map((id) => (
          <li key={id} data-inscription={id}>
            <span className={RARITY_TEXT[inscriptionRarity(id)]}>{inscriptionName(id)}</span>
            <span className="text-white/55"> {INSCRIPTION_TEXT[id]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FaithList({ faith }: { faith: Faith }) {
  const gods = GODS.filter((god) => (faith[god] ?? 0) > 0), blessed = blessingsOf(faith);
  if (gods.length === 0) return null;
  return (
    <section id="character-faith" className="mt-2 border-t border-white/10 pt-2 text-xs">
      <span className="tracking-[0.12em] text-white/70 uppercase">Faith</span>
      <ul className="mt-1 flex flex-col gap-1">
        {gods.map((god) => {
          const blessing = blessed.find((b) => b === god);
          return (
            <li key={god} data-god={god}>
              <span className="flex justify-between">
                <span className={blessing ? "text-victory" : "text-white/85"}>{GOD_NAMES[god]}</span>
                <span className="text-white/55 tabular-nums">{faith[god]} / {BLESSING_FAITH}</span>
              </span>
              {blessing && <span className="text-white/55">{BLESSING_TEXT[blessing]}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
