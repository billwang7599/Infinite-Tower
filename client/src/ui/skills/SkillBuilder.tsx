import { releaseTime, skillCost, type Rejection, type Word } from "@infinite-tower/shared";
import { useRef, useState } from "react";
import type { Actions } from "../../core/actions.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { TEXT_INPUT } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { choices, kindOf, quickPick, skillOf, wordTitle, type WordKind } from "./chant.js";

const SQUARE_PX = 76;
const STEP_PX = SQUARE_PX + 12;
const PICKS = ["pick1", "pick2", "pick3", "pick4", "pick5", "pick6", "pick7", "pick8", "pick9"] as const;

const KIND_BORDER: Record<WordKind, string> = {
  form: "border-victory/80", element: "border-sky-300/70", modifier: "border-fuchsia-300/70",
};
const KIND_NAME: Record<WordKind, string> = { form: "Form", element: "Element", modifier: "Modifier" };
const WHY: Record<Rejection, string> = {
  "not-learned": "not learned", "no-chaining": "chaining needs a second Form", repeated: "already in",
  opposite: "its opposite is in", "doesnt-fit": "doesn't fit this Form",
};

interface BuilderProps {
  words: readonly Word[];
  known: ReadonlySet<Word>;
  input: Actions;
  pick: (word: Word) => void;
  undo: () => void;
  busy?: boolean;
}

export function SkillBuilder({ words, known, input, pick, undo, busy = false }: BuilderProps) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const listed = choices(words, known, query);
  const skill = skillOf(words);
  const next = [...new Set(listed.map((c) => KIND_NAME[kindOf(c.word)]))];

  const choose = (word: Word | null) => {
    if (!word || busy) return;
    pick(word);
    setQuery("");
    search.current?.blur();
  };

  useAction(input, [...PICKS, "undoWord", "findWord"], (action) => {
    if (action === "findWord") search.current?.focus();
    else if (action === "undoWord") {
      if (query !== "" && document.activeElement === search.current) return false;
      if (!busy) undo();
    } else choose(quickPick(listed, PICKS.indexOf(action) + 1));
  });

  let number = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-24 w-full overflow-hidden">
        <ol
          className="absolute top-2 left-1/2 flex gap-3 transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${-(words.length * STEP_PX + SQUARE_PX / 2)}px)` }}
        >
          {words.map((word, i) => (
            <li
              key={i} data-word={word}
              className={`relative flex shrink-0 flex-col items-center justify-center rounded-sm border-2 bg-black/50 ${
                KIND_BORDER[kindOf(word)]
              } ${i < words.length - 3 ? "opacity-40" : ""}`}
              style={{ width: SQUARE_PX, height: SQUARE_PX }}
            >
              {i > 0 && kindOf(word) === "form" && (
                <span aria-label="next segment" className="absolute top-1/2 -left-3 -translate-y-1/2 text-victory">
                  ⛓
                </span>
              )}
              <span className="text-sm">{wordTitle(word)}</span>
              <span className="text-[10px] font-normal text-white/50">{KIND_NAME[kindOf(word)]}</span>
            </li>
          ))}
          <li
            className={
              "flex shrink-0 items-center justify-center rounded-sm border-2 border-dashed border-white/50 p-1 "
              + "text-center text-[11px] font-normal text-white/60"
            }
            style={{ width: SQUARE_PX, height: SQUARE_PX }}
          >
            {next.join(" / ") || "—"}
          </li>
        </ol>
      </div>

      <form
        className="flex w-full flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          choose(quickPick(listed, 1));
        }}
      >
        <input
          ref={search} id="skill-search" className={TEXT_INPUT} placeholder="Search words" value={query}
          autoComplete="off" spellCheck={false} disabled={busy} onChange={(e) => setQuery(e.target.value)}
        />
        <ul id="skill-words" className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
          {listed.map(({ word, why }) => {
            const n = why === null ? ++number : null;
            return (
              <li key={word}>
                <button
                  type="button" {...NO_FOCUS} data-word={word} disabled={why !== null || busy}
                  onClick={() => choose(word)}
                  className={
                    "pointer-events-auto flex w-full cursor-pointer items-baseline gap-2 rounded-sm border "
                    + "border-white/15 px-2 py-1 text-left text-sm enabled:hover:bg-white/10 disabled:cursor-default "
                    + "disabled:opacity-40"
                  }
                >
                  <span className="w-3 text-xs text-victory tabular-nums">{n !== null && n <= 9 ? n : ""}</span>
                  <span>{wordTitle(word)}</span>
                  {why && <span className="ml-auto text-[10px] font-normal">{WHY[why]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </form>

      <p id="skill-cost" className="text-xs font-normal text-white/60 tabular-nums">
        {skill ? `${skillCost(skill)} stamina · ${releaseTime(skill).toFixed(1)} s to release` : "Pick a Form"}
      </p>
    </div>
  );
}
