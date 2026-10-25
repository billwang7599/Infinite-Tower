/**
 * Making (first visit) or changing the player's character: a name and a look (cloak, skin, trousers), with a
 * preview. On a first visit it can't be closed, only saved (or left via Return to title); the server holds the
 * level back until then. Esc closes it otherwise. Saving waits for the server's answer, which closes it.
 */
import {
  CHARACTER_NAME_RULES, DEFAULT_LOOK, LOOK_PARTS, LOOKS, rulesHint, type Character, type Look, type LookPart,
} from "@infinite-tower/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "../../components/Dialog.js";
import { BUTTON, DIALOG_BOX, DIALOG_TITLE, TEXT_INPUT } from "../../components/styles.js";
import { useKeydown } from "../../components/useKeydown.js";
import type { CharacterScreenState, FieldHudState, TitleState, UiActions } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { SpritePreview } from "./SpritePreview.js";
import { PART_LABELS, swatchColor } from "./swatches.js";

/** The server answers a valid save at once; no answer by then means it refused it. */
const SAVE_TIMEOUT_MS = 5000;

interface EditorProps {
  screen: Store<CharacterScreenState>;
  /** Holds the current character (null on a first visit). */
  field: Store<FieldHudState>;
  /** The username suggests a new character's name. */
  title: Store<TitleState>;
  close: () => void;
  actions: Pick<UiActions, "saveCharacter" | "returnToTitle">;
}

export function CharacterEditor({ screen, field, title, close, actions }: EditorProps) {
  const { open, firstTime } = useStore(screen, (s) => s);
  const current = useStore(field, (s) => s.character);
  const username = useStore(title, (s) => s.username);
  if (!open) return null;
  // Usernames may have "_", names may not: "sir_boar" suggests "sir boar".
  const start = current ?? { name: (username ?? "").replaceAll("_", " "), look: DEFAULT_LOOK };
  return (
    <EditorForm
      key={current ? JSON.stringify(current) : "new"}
      firstTime={firstTime} start={start} close={close} actions={actions}
    />
  );
}

interface FormProps extends Pick<EditorProps, "close" | "actions"> {
  firstTime: boolean;
  start: Character;
}

function EditorForm({ firstTime, start, close, actions }: FormProps) {
  const [name, setName] = useState(start.name.slice(0, CHARACTER_NAME_RULES.max));
  const [look, setLook] = useState<Look>(start.look);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A valid save closes this (the server answers with `character`).
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      setSaving(false);
      setError("The server didn't take that. Try again.");
    }, SAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saving]);

  // Capture + stopImmediatePropagation: Esc here is the editor's, so it doesn't also open Settings.
  useKeydown((e) => {
    if (e.code !== "Escape") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!firstTime) close();
  }, { capture: true });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (saving) return;
    // The input's own checks count leading / trailing spaces; the server doesn't.
    if (trimmed.length < CHARACTER_NAME_RULES.min) {
      setError(`Names need at least ${CHARACTER_NAME_RULES.min} letters.`);
      return;
    }
    setError(null);
    setSaving(true);
    actions.saveCharacter({ name: trimmed, look });
  };

  return (
    <Dialog id="character-editor" titleId="character-editor-title" dim="bg-black/70">
      <form onSubmit={submit} className={`flex w-[min(560px,92vw)] flex-col gap-5 px-7 py-6 ${DIALOG_BOX}`}>
        <h2 id="character-editor-title" className={DIALOG_TITLE}>
          {firstTime ? "Who are you?" : "Your character"}
        </h2>
        <div className="flex gap-6">
          <div
            className="flex size-40 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-black/40"
          >
            <SpritePreview look={look} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Name
              <input
                name="character-name" required autoFocus autoComplete="off" spellCheck={false}
                minLength={CHARACTER_NAME_RULES.min} maxLength={CHARACTER_NAME_RULES.max}
                pattern={CHARACTER_NAME_RULES.pattern} title={rulesHint(CHARACTER_NAME_RULES)}
                value={name} onChange={(e) => { setName(e.target.value); setError(null); }} disabled={saving}
                className={TEXT_INPUT}
              />
            </label>
            {LOOK_PARTS.map((part) => (
              <Swatches key={part} part={part} value={look[part]} onPick={(id) => setLook({ ...look, [part]: id })} />
            ))}
          </div>
        </div>
        <p id="character-error" className="-my-2 min-h-5 text-sm text-error">{error}</p>
        <footer className="flex items-center justify-between">
          {firstTime ? (
            <button
              type="button" onClick={actions.returnToTitle}
              className="cursor-pointer text-sm text-white/55 hover:text-white"
            >
              Return to title
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            {!firstTime && <button type="button" onClick={close} className={BUTTON.plain}>Cancel</button>}
            <button type="submit" disabled={saving} className={BUTTON.primary}>
              {saving ? "Saving…" : firstTime ? "Begin" : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}

const SWATCH =
  "size-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 "
  + "focus-visible:outline-offset-2 focus-visible:outline-victory";

function Swatches({ part, value, onPick }: { part: LookPart; value: string; onPick: (id: string) => void }) {
  return (
    <fieldset data-part={part} className="flex items-center gap-3">
      <legend className="float-left w-20 text-sm text-white/70">{PART_LABELS[part]}</legend>
      <div className="flex flex-wrap gap-2">
        {LOOKS[part].map((option) => (
          <button
            key={option.id} type="button" aria-label={option.label} aria-pressed={option.id === value}
            data-option={option.id} onClick={() => onPick(option.id)}
            style={{ backgroundColor: swatchColor(option.colors) }}
            className={`${SWATCH} ${option.id === value ? "border-victory" : "border-white/20"}`}
          />
        ))}
      </div>
    </fieldset>
  );
}
