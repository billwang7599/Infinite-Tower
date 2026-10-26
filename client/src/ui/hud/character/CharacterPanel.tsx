/**
 * The field's character panel: the player's portrait, name and stats. It doesn't pause or block walking; the field
 * HUD's button or the Character key (field.character) toggles it. The look is kept for good, so nothing here edits it.
 */
import { LookPicture } from "../../components/LookPicture.js";
import type { FieldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";
import { STAT_KEYS, STAT_TEXT } from "./statText.js";

interface PanelProps {
  hud: Store<FieldHudState>;
  close: () => void;
}

export function CharacterPanel({ hud, close }: PanelProps) {
  const stats = useStore(hud, (s) => s.stats);
  const character = useStore(hud, (s) => s.character);
  return (
    <PanelFrame id="character-panel" title={character?.name ?? "Character"} titleId="character-name" close={close}>
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
