/**
 * The creation panel: a name, then a row per choice (options.ts). Up / Down (or W / S off the name) pick a row,
 * Left / Right (A / D) step through its options; the mouse works too. Enter, or Begin, asks to confirm.
 */
import { CHARACTER_NAME_RULES, rulesHint } from "@infinite-tower/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NO_FOCUS } from "../../components/noFocus.js";
import { useKeydown } from "../../components/useKeydown.js";
import { optionName, ROWS, shuffled, stepped, valueOf, withValue, type Choices, type Row } from "./options.js";
import { BUTTON, CAPS, SHEET } from "./styles.js";

const UP = ["ArrowUp", "KeyW"], DOWN = ["ArrowDown", "KeyS"];
const LEFT = ["ArrowLeft", "KeyA"], RIGHT = ["ArrowRight", "KeyD"];
/** Rows: the name, then ROWS. */
const NAME_ROW = 0;

interface MakerProps {
  name: string;
  setName: (name: string) => void;
  choices: Choices;
  setChoices: (choices: Choices) => void;
  /** Checked and asks to confirm (CreationScreen). */
  begin: () => void;
  error: string | null;
  /** Off while the System asks to confirm, and after. */
  enabled: boolean;
  /** Faded out once the character is sent. */
  shown: boolean;
}

export function LookMaker({ name, setName, choices, setChoices, begin, error, enabled, shown }: MakerProps) {
  const [row, setRow] = useState(NAME_ROW);
  const input = useRef<HTMLInputElement>(null);

  // Typing goes to the name only while its row is picked, so letters can't be lost to it from another row.
  useEffect(() => {
    if (enabled && row === NAME_ROW) input.current?.focus();
    else input.current?.blur();
  }, [row, enabled]);

  useKeydown((e) => {
    const typing = e.target === input.current;
    const is = (keys: string[]) => keys.includes(e.code) && (!typing || e.code.startsWith("Arrow"));
    const picked = ROWS[row - 1];
    if (is(UP) || is(DOWN)) {
      e.preventDefault();
      setRow((r) => (r + (is(UP) ? -1 : 1) + ROWS.length + 1) % (ROWS.length + 1));
    } else if (picked && (is(LEFT) || is(RIGHT))) {
      e.preventDefault();
      setChoices(stepped(choices, picked, is(LEFT) ? -1 : 1));
    } else if (e.code === "Enter" && !typing) {
      e.preventDefault();
      begin();
    }
  }, { enabled });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    begin();
  };

  return (
    <form
      id="look-maker" onSubmit={submit} aria-disabled={!enabled}
      className={`flex w-[min(440px,40vw)] flex-col transition-opacity duration-500 ${SHEET} ${
        !shown ? "pointer-events-none opacity-0" : !enabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <label
        data-row="name" onClick={() => setRow(NAME_ROW)}
        className={`flex flex-col gap-1 px-5 pt-4 pb-3 ${row === NAME_ROW ? PICKED : ""}`}
      >
        <span className={CAPS}>Name</span>
        <input
          ref={input} name="character-name" required autoComplete="off" spellCheck={false}
          minLength={CHARACTER_NAME_RULES.min} maxLength={CHARACTER_NAME_RULES.max}
          pattern={CHARACTER_NAME_RULES.pattern} title={rulesHint(CHARACTER_NAME_RULES)}
          value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setRow(NAME_ROW)}
          className={NAME_INPUT}
        />
      </label>
      <div className="flex flex-col border-y border-ink/8 py-1.5">
        {ROWS.map((r, i) => (
          <ChoiceRow
            key={r.key} row={r} value={valueOf(choices, r.key)} picked={row === i + 1}
            select={() => setRow(i + 1)} pick={(id) => setChoices(withValue(choices, r.key, id))}
            step={(by) => setChoices(stepped(choices, r, by))}
          />
        ))}
      </div>
      <p id="creation-error" role="alert" className="min-h-6 px-5 pt-2 text-sm text-ink-error">{error}</p>
      <footer className="flex items-center justify-between px-5 pt-1 pb-4">
        <button type="button" {...NO_FOCUS} onClick={() => setChoices(shuffled(choices))} className={BUTTON.plain}>
          Shuffle
        </button>
        <button type="submit" {...NO_FOCUS} className={BUTTON.primary}>Begin</button>
      </footer>
    </form>
  );
}

const NAME_INPUT =
  "border-b border-ink/20 bg-transparent py-1 text-xl tracking-wide text-ink outline-none focus:border-gilt";
const SWATCH = "size-5 cursor-pointer rounded-full border border-ink/25 transition-transform hover:scale-115";
/** The picked row: a gold bar down its left edge, on a faint grey. */
const PICKED = "bg-ink/[0.045] shadow-[inset_3px_0_0_var(--color-gilt)]";

interface RowProps {
  row: Row;
  value: string;
  picked: boolean;
  select: () => void;
  pick: (id: string) => void;
  step: (by: 1 | -1) => void;
}

function ChoiceRow({ row, value, picked, select, pick, step }: RowProps) {
  return (
    <div
      data-row={row.key} data-value={value} role="group" aria-label={row.label} onMouseDown={select}
      className={`grid h-9 grid-cols-[8.5rem_1fr] items-center px-5 ${picked ? PICKED : ""}`}
    >
      <span className={CAPS}>{row.label}</span>
      {row.swatch ? (
        <div className="flex gap-1.5">
          {row.options.map((id) => (
            <button
              key={id} type="button" {...NO_FOCUS} aria-label={optionName(id)} aria-pressed={id === value}
              data-option={id} onClick={() => pick(id)} style={{ backgroundColor: row.swatch!(id) }}
              className={`${SWATCH} ${
                id === value ? "ring-2 ring-gilt ring-offset-2 ring-offset-white" : ""
              }`}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between text-ink">
          <Arrow label="Previous" onClick={() => step(-1)}>‹</Arrow>
          <span className="flex flex-col items-center gap-1">
            <span className="text-[15px] tracking-wide">{optionName(value)}</span>
            <span className="flex gap-1">
              {row.options.map((id) => (
                <span key={id} className={`size-1 rounded-full ${id === value ? "bg-gilt" : "bg-ink/20"}`} />
              ))}
            </span>
          </span>
          <Arrow label="Next" onClick={() => step(1)}>›</Arrow>
        </div>
      )}
    </div>
  );
}

function Arrow({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button" {...NO_FOCUS} aria-label={label} onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center text-xl text-ink/45 hover:text-gilt"
    >
      {children}
    </button>
  );
}
