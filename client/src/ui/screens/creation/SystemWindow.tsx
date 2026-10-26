/**
 * The System speaking: a window with its line typed out. With `choices`, the line is a question and the choices
 * sit under it once it's typed (`picked` is highlighted); otherwise a blinking mark says a key or a click goes on.
 */
import { NO_FOCUS } from "../../components/noFocus.js";
import { CAPS, SHEET } from "./styles.js";
import type { Typed } from "./useTyped.js";

interface WindowProps {
  typed: Typed;
  /** Whether the blinking "go on" mark shows once the line is typed. */
  goesOn: boolean;
  choices?: { labels: readonly string[]; picked: number; pick: (i: number) => void };
  onClick?: () => void;
  /** Its width. */
  className: string;
}

const CHOICE = "cursor-pointer border px-4 py-1.5 text-sm tracking-[0.12em] transition-colors";
const CHOICE_PICKED = "border-gilt bg-gilt text-white";
const CHOICE_OTHER = "border-ink/20 text-ink/70 hover:border-ink/45";

export function SystemWindow({ typed, goesOn, choices, onClick, className }: WindowProps) {
  return (
    <section
      id="system-window" aria-live="polite" onClick={onClick}
      className={`origin-top animate-window-in motion-reduce:animate-none ${SHEET} ${className} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <header className={`flex items-center gap-2.5 border-b border-ink/10 px-5 py-2 ${CAPS}`}>
        <span className="size-1.5 rotate-45 bg-gilt" />
        System
      </header>
      <p id="system-line" className="min-h-[4.5em] px-5 pt-4 pb-3 text-[17px] leading-relaxed text-ink">
        {typed.shown}
        {typed.done && goesOn && <span className="ml-2 inline-block animate-blink text-xs text-gilt">▼</span>}
      </p>
      {choices && typed.done && (
        <div className="flex gap-2 px-5 pb-4">
          {choices.labels.map((label, i) => (
            <button
              key={label} type="button" {...NO_FOCUS} data-choice={i} onClick={() => choices.pick(i)}
              className={`${CHOICE} ${i === choices.picked ? CHOICE_PICKED : CHOICE_OTHER}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
