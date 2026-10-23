/**
 * Making (first visit) or changing the player's character: a name and a look (cloak, skin, trousers), with a
 * preview. On a first visit it can't be closed, only saved (or left via Return to title); the server holds the
 * level back until then. Esc closes it otherwise. Saving waits for the server's answer, which closes it.
 */
import { CHARACTER_NAME_RULES, DEFAULT_LOOK, LOOK_PARTS, LOOKS, type Character, type Look, type LookPart } from "@infinite-tower/shared";
import { useEffect, useState, type FormEvent } from "react";
import type { CharacterScreenState, UiActions } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { BUTTON } from "../settings/buttons.js";
import { SpritePreview } from "./SpritePreview.js";
import { PART_LABELS, SAVE_TIMEOUT_MS, swatchColor } from "./swatches.js";

interface EditorProps {
  screen: Store<CharacterScreenState>;
  /** What the form starts from: the current character, or null on a first visit. */
  current: Character | null;
  /** The name a new character starts with. */
  suggestedName: string;
  close: () => void;
  actions: Pick<UiActions, "saveCharacter" | "returnToTitle">;
}

export function CharacterEditor({ screen, current, suggestedName, close, actions }: EditorProps) {
  const { open, firstTime } = useStore(screen, (s) => s);
  if (!open) return null;
  return (
    <EditorForm
      key={current ? JSON.stringify(current) : "new"}
      firstTime={firstTime} start={current ?? { name: suggestedName, look: DEFAULT_LOOK }} close={close} actions={actions}
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

  // The server answers a valid save at once (which closes this); silence means it refused it.
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => { setSaving(false); setError("The server didn't take that. Try again."); }, SAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saving]);

  // Capture + stopImmediatePropagation: Esc here is the editor's, so it doesn't also open Settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!firstTime) close();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [firstTime, close]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (saving) return;
    // The input's own checks count leading / trailing spaces; the server doesn't.
    if (trimmed.length < CHARACTER_NAME_RULES.min) { setError(`Names need at least ${CHARACTER_NAME_RULES.min} letters.`); return; }
    setError(null);
    setSaving(true);
    actions.saveCharacter({ name: trimmed, look });
  };

  return (
    <div
      id="character-editor" role="dialog" aria-modal="true" aria-labelledby="character-editor-title"
      className="fixed inset-0 flex items-center justify-center bg-black/70 font-ui text-white select-none"
    >
      <form onSubmit={submit} className="flex w-[min(560px,92vw)] flex-col gap-5 rounded-sm border border-white/15 bg-night/95 px-7 py-6 shadow-[0_20px_60px_#000c]">
        <h2 id="character-editor-title" className="font-title text-3xl tracking-[0.08em] text-victory">
          {firstTime ? "Who are you?" : "Your character"}
        </h2>
        <div className="flex gap-6">
          <div className="flex size-40 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-black/40">
            <SpritePreview look={look} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-white/70">
              Name
              <input
                name="character-name" required autoFocus autoComplete="off" spellCheck={false}
                minLength={CHARACTER_NAME_RULES.min} maxLength={CHARACTER_NAME_RULES.max} pattern={CHARACTER_NAME_RULES.pattern}
                title={`${CHARACTER_NAME_RULES.min}-${CHARACTER_NAME_RULES.max} letters, digits, spaces, ' or -`}
                value={name} onChange={(e) => { setName(e.target.value); setError(null); }} disabled={saving}
                className="rounded-sm border border-white/20 bg-black/50 px-3 py-2 text-base text-white focus-visible:border-victory/70 focus-visible:outline-none"
              />
            </label>
            {LOOK_PARTS.map((part) => (
              <Swatches key={part} part={part} value={look[part]} onPick={(id) => setLook({ ...look, [part]: id })} />
            ))}
          </div>
        </div>
        <p id="character-error" className="-my-2 min-h-5 text-sm text-[#ff8f86]">{error}</p>
        <footer className="flex items-center justify-between">
          {firstTime
            ? <button type="button" onClick={actions.returnToTitle} className="cursor-pointer text-sm text-white/55 hover:text-white">Return to title</button>
            : <span />}
          <div className="flex gap-3">
            {!firstTime && <button type="button" onClick={close} className={BUTTON.plain}>Cancel</button>}
            <button type="submit" disabled={saving} className={BUTTON.primary}>
              {saving ? "Saving…" : firstTime ? "Begin" : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Swatches({ part, value, onPick }: { part: LookPart; value: string; onPick: (id: string) => void }) {
  return (
    <fieldset data-part={part} className="flex items-center gap-3">
      <legend className="float-left w-20 text-sm text-white/70">{PART_LABELS[part]}</legend>
      <div className="flex flex-wrap gap-2">
        {LOOKS[part].map((option) => (
          <button
            key={option.id} type="button" aria-label={option.label} aria-pressed={option.id === value} data-option={option.id}
            onClick={() => onPick(option.id)}
            style={{ backgroundColor: swatchColor(part, option.id) }}
            className={`size-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-victory ${
              option.id === value ? "border-victory" : "border-white/20"
            }`}
          />
        ))}
      </div>
    </fieldset>
  );
}
