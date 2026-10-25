/**
 * The field's character panel: the player's name and stats, and Change look (the character editor). It doesn't
 * pause or block walking; the field HUD's button or the Character key (field.character) toggles it.
 */
import { NO_FOCUS } from "../../components/noFocus.js";
import { BUTTON } from "../../components/styles.js";
import type { FieldHudState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { PanelFrame } from "../PanelFrame.js";
import { STAT_KEYS, STAT_TEXT } from "./statText.js";

interface PanelProps {
  hud: Store<FieldHudState>;
  close: () => void;
  edit: () => void;
}

export function CharacterPanel({ hud, close, edit }: PanelProps) {
  const stats = useStore(hud, (s) => s.stats);
  const name = useStore(hud, (s) => s.character?.name);
  return (
    <PanelFrame id="character-panel" title={name ?? "Character"} titleId="character-name" close={close}>
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
        type="button" id="character-edit" {...NO_FOCUS} onClick={edit}
        className={`pointer-events-auto mt-4 w-full ${BUTTON.plain}`}
      >
        Change look
      </button>
    </PanelFrame>
  );
}
