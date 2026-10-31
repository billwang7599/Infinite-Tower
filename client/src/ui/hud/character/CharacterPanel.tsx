import {
  carryLimit, coreName, coreStats, maxHpOf, moveSpeed, physicalDamage, physicalTakenFactor, pointsLeft, SHOWN_STATS,
  skillDamage, skillTakenFactor, staminaMaxOf, type ShownStat, type Stats,
} from "@infinite-tower/shared";
import { LookPicture } from "../../components/LookPicture.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import type { OverworldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { CHARACTER_PANEL_WIDTH_PX } from "../layout.js";
import { PanelFrame } from "../PanelFrame.js";

const times = (factor: number) => `×${factor.toFixed(2)}`;

/** In the order the panel lists them (the rules: shared/src/battle/stats.ts). */
const STAT_TEXT: Record<ShownStat, { name: string; effect: (stats: Stats) => string }> = {
  strength: {
    name: "Strength",
    effect: (s) => `Physical damage ${times(physicalDamage(1, s))}, carry limit ${Math.round(carryLimit(s))}`,
  },
  agility: { name: "Agility", effect: (s) => `Walking and dodging ${times(moveSpeed(1, s))}` },
  stamina: { name: "Stamina", effect: (s) => `Stamina bar: ${staminaMaxOf(s)}` },
  skillpower: { name: "Skillpower", effect: (s) => `Skill damage ${times(skillDamage(1, s))}` },
  vitality: { name: "Vitality", effect: (s) => `HP: ${maxHpOf(s)}` },
  defense: { name: "Defense", effect: (s) => `Physical damage taken ${times(physicalTakenFactor(s))}` },
  specialDefense: { name: "Special defense", effect: (s) => `Skill damage taken ${times(skillTakenFactor(s))}` },
};

const POINT_BUTTON =
  "pointer-events-auto size-5 cursor-pointer rounded-sm border border-white/25 leading-none "
  + "enabled:hover:border-white/60 enabled:hover:bg-white/10 disabled:cursor-default disabled:opacity-30";

interface PanelProps {
  hud: Store<OverworldHudState>;
  statPoint: (stat: ShownStat, add: boolean) => void;
  close: () => void;
}

export function CharacterPanel({ hud, statPoint, close }: PanelProps) {
  const core = useStore(hud, (s) => s.core);
  const byFire = useStore(hud, (s) => s.byFire);
  const character = useStore(hud, (s) => s.character);
  const stats = core && coreStats(core), free = core ? pointsLeft(core) : 0;
  return (
    <PanelFrame
      id="character-panel" title={character?.name ?? "Character"} titleId="character-name"
      width={CHARACTER_PANEL_WIDTH_PX} close={close}
    >
      {character && (
        <LookPicture
          look={character.look} view="portrait"
          className="mx-auto -mt-1 mb-3 size-[128px] border-b border-white/10"
        />
      )}
      {core && stats && (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span id="character-core" className="font-title text-base tracking-wide text-victory">
              {coreName(core)}
            </span>
            <span id="character-points" className="text-xs text-white/70">
              Free points: <span className="font-semibold text-white tabular-nums">{free}</span>
            </span>
          </div>
          <dl className="flex flex-col gap-2">
            {SHOWN_STATS.map((key) => (
              <div key={key} data-stat={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2">
                <dt className="font-semibold">{STAT_TEXT[key].name}</dt>
                <dd className="text-right font-semibold text-victory tabular-nums">{stats[key]}</dd>
                <dd className="flex gap-1">
                  <button
                    type="button" aria-label={`Take a point back from ${STAT_TEXT[key].name}`} {...NO_FOCUS}
                    className={POINT_BUTTON} disabled={!byFire || !core.points[key]}
                    onClick={() => statPoint(key, false)}
                  >
                    −
                  </button>
                  <button
                    type="button" aria-label={`Place a point in ${STAT_TEXT[key].name}`} {...NO_FOCUS}
                    className={POINT_BUTTON} disabled={free <= 0} onClick={() => statPoint(key, true)}
                  >
                    +
                  </button>
                </dd>
                <dd className="col-span-3 text-xs text-white/55">{STAT_TEXT[key].effect(stats)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </PanelFrame>
  );
}
