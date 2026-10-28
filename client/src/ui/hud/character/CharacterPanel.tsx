/** The player's portrait, name and stats. It doesn't pause or block walking. */
import type { Stats } from "@infinite-tower/shared";
import { LookPicture } from "../../components/LookPicture.js";
import type { OverworldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { CHARACTER_PANEL_WIDTH_PX } from "../layout.js";
import { PanelFrame } from "../PanelFrame.js";

/** In the order the panel lists them (the rules: shared/src/battle/stats.ts). */
const STAT_TEXT: Record<keyof Stats, { name: string; effect: (value: number) => string }> = {
  strength: { name: "Strength", effect: (v) => `Physical damage ×${(v / 10).toFixed(1)}` },
  agility: { name: "Agility", effect: (v) => `Movement in fights ×${(v / 10).toFixed(1)}` },
  stamina: { name: "Stamina", effect: (v) => `Stamina bar: ${v}` },
  intellect: { name: "Intellect", effect: (v) => `Spell damage ×${(v / 10).toFixed(1)}` },
};
const STAT_KEYS = Object.keys(STAT_TEXT) as (keyof Stats)[];

interface PanelProps {
  hud: Store<OverworldHudState>;
  close: () => void;
}

export function CharacterPanel({ hud, close }: PanelProps) {
  const stats = useStore(hud, (s) => s.stats);
  const character = useStore(hud, (s) => s.character);
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
      {stats && (
        <dl className="flex flex-col gap-2">
          {STAT_KEYS.map((key) => (
            <div key={key} data-stat={key} className="grid grid-cols-[1fr_auto] gap-x-3">
              <dt className="font-semibold">{STAT_TEXT[key].name}</dt>
              <dd className="text-right font-semibold text-victory tabular-nums">{stats[key]}</dd>
              <dd className="col-span-2 text-xs text-white/55">{STAT_TEXT[key].effect(stats[key])}</dd>
            </div>
          ))}
        </dl>
      )}
    </PanelFrame>
  );
}
