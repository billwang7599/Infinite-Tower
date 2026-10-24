/**
 * The field's character panel: the player's name and stats, and Change look (the character editor). It doesn't
 * pause or block walking; the field HUD's button or the Character key (field.character) toggles it.
 */
import { STAT_KEYS, type Character, type Stats } from "@infinite-tower/shared";
import { BUTTON } from "../../screens/settings/buttons.js";
import { PanelFrame } from "../PanelFrame.js";
import { STAT_TEXT } from "./statText.js";

interface PanelProps {
  stats: Stats | null;
  character: Character | null;
  close: () => void;
  edit: () => void;
}

export function CharacterPanel({ stats, character, close, edit }: PanelProps) {
  return (
    <PanelFrame id="character-panel" title={character?.name ?? "Character"} titleId="character-name" close={close}>
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
      <button
        type="button" id="character-edit" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={edit}
        className={`pointer-events-auto mt-4 w-full ${BUTTON.plain}`}
      >
        Change look
      </button>
    </PanelFrame>
  );
}
