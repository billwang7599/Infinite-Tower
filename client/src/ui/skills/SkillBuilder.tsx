import {
  releaseTime, skillCost, skillOf, wordKind, type Rejection, type Word, type WordKind,
} from "@infinite-tower/shared";
import { useRef, useState } from "react";
import type { Actions } from "../../core/actions.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { TEXT_INPUT } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import {
  addWord, back, choices, KINDS, kindOpen, numbered, openKind, pickNumber, wordTitle, type ChantState,
} from "./chant.js";

const SQUARE_PX = 76;
const STEP_PX = SQUARE_PX + 12;
const PICKS = ["pick1", "pick2", "pick3", "pick4", "pick5", "pick6", "pick7", "pick8", "pick9"] as const;

const KIND_LOOK: Record<WordKind, { border: string; fill: string; text: string }> = {
  form: { border: "border-victory/80", fill: "bg-victory/15", text: "text-victory" },
  element: { border: "border-sky-300/70", fill: "bg-sky-300/15", text: "text-sky-300" },
  modifier: { border: "border-fuchsia-300/70", fill: "bg-fuchsia-300/15", text: "text-fuchsia-300" },
};
const KIND_NAME: Record<WordKind, string> = { form: "Form", element: "Element", modifier: "Modifier" };
const WHY: Record<Rejection, string> = {
  "not-learned": "not learned", "no-chaining": "chaining needs a second Form", repeated: "already in",
  opposite: "its opposite is in", "doesnt-fit": "doesn't fit this Form",
};

interface BuilderProps {
  chant: ChantState;
  known: ReadonlySet<Word>;
  input: Actions;
  change: (chant: ChantState) => void;
  busy?: boolean;
}

export function SkillBuilder({ chant, known, input, change, busy = false }: BuilderProps) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const { words } = chant;
  const skill = skillOf(words);
  const searching = query.trim() !== "";
  const keyed = numbered(chant, known, query);
  const next = chant.kind ? [chant.kind] : KINDS.filter((kind) => kindOpen(words, known, kind));
  const nextLook = chant.kind
    ? `${KIND_LOOK[chant.kind].border} ${KIND_LOOK[chant.kind].text}` : "border-white/50 text-white/60";

  const apply = (to: ChantState) => {
    if (busy || to === chant) return;
    change(to);
    if (to.words === words) return;
    setQuery("");
    search.current?.blur();
  };

  useAction(input, [...PICKS, "undoWord", "findWord"], (action) => {
    if (action === "findWord") search.current?.focus();
    else if (action === "undoWord") {
      if (query !== "" && document.activeElement === search.current) return false;
      apply(back(chant));
    } else apply(pickNumber(chant, PICKS.indexOf(action) + 1, known, query));
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-24 w-full overflow-hidden">
        <ol
          className="absolute top-2 left-1/2 flex gap-3 transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${-(words.length * STEP_PX + SQUARE_PX / 2)}px)` }}
        >
          {words.map((word, i) => {
            const look = KIND_LOOK[wordKind(word)];
            return (
              <li
                key={i} data-word={word}
                className={`relative flex shrink-0 flex-col items-center justify-center rounded-sm border-2 ${
                  look.border} ${look.fill} ${i < words.length - 3 ? "opacity-40" : ""}`}
                style={{ width: SQUARE_PX, height: SQUARE_PX }}
              >
                {i > 0 && wordKind(word) === "form" && (
                  <span aria-label="next segment" className="absolute top-1/2 -left-3 -translate-y-1/2 text-victory">
                    ⛓
                  </span>
                )}
                <span className="text-sm">{wordTitle(word)}</span>
                <span className={`text-[10px] font-normal ${look.text}`}>{KIND_NAME[wordKind(word)]}</span>
              </li>
            );
          })}
          <li
            className={
              "flex shrink-0 items-center justify-center rounded-sm border-2 border-dashed p-1 text-center text-[11px] "
              + `font-normal ${nextLook}`
            }
            style={{ width: SQUARE_PX, height: SQUARE_PX }}
          >
            {next.map((kind) => KIND_NAME[kind]).join(" / ") || "—"}
          </li>
        </ol>
      </div>

      <form
        className="flex w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const first = choices(words, known, query).find((c) => c.why === null);
          if (first) apply(addWord(chant, first.word, known));
        }}
      >
        <input
          ref={search} id="skill-search" className={TEXT_INPUT} placeholder="Search words" value={query}
          autoComplete="off" spellCheck={false} disabled={busy} onChange={(e) => setQuery(e.target.value)}
        />
        <div id="skill-words" className="grid min-h-76 grid-cols-3 gap-2">
          {KINDS.map((kind, k) => {
            const look = KIND_LOOK[kind];
            const chosen = chant.kind === kind;
            return (
              <section
                key={kind} aria-label={KIND_NAME[kind]}
                className={`flex flex-col gap-1 ${chant.kind && !chosen ? "opacity-50" : ""}`}
              >
                <button
                  type="button" {...NO_FOCUS} data-kind={kind} disabled={!kindOpen(words, known, kind) || busy}
                  onClick={() => {
                    setQuery("");
                    apply(openKind(chant, kind, known));
                  }}
                  className={
                    "flex cursor-pointer items-baseline gap-2 rounded-sm border-b-2 px-2 py-1 text-left "
                    + `disabled:cursor-default disabled:border-white/15 disabled:opacity-35 ${look.border} ${
                      chosen ? look.fill : "enabled:hover:bg-white/10"}`
                  }
                >
                  <span className={`w-3 text-xs tabular-nums ${look.text}`}>
                    {chant.kind === null && !searching ? k + 1 : ""}
                  </span>
                  <span className={`text-sm tracking-wide ${look.text}`}>{KIND_NAME[kind]}</span>
                </button>
                <ul className="flex flex-col gap-1">
                  {choices(words, known, query, kind).map(({ word, why }) => {
                    const n = keyed.findIndex((c) => c.word === word) + 1;
                    return (
                      <li key={word}>
                        <button
                          type="button" {...NO_FOCUS} data-word={word} disabled={why !== null || busy}
                          onClick={() => apply(addWord(chant, word, known))}
                          className={
                            "flex w-full cursor-pointer flex-wrap items-baseline gap-x-2 rounded-sm border "
                            + "border-white/15 px-2 py-1 text-left text-sm enabled:hover:bg-white/10 "
                            + "disabled:cursor-default disabled:opacity-40"
                          }
                        >
                          <span className={`w-3 text-xs tabular-nums ${look.text}`}>{n > 0 && n <= 9 ? n : ""}</span>
                          <span>{wordTitle(word)}</span>
                          {why && <span className="ml-auto text-[10px] font-normal">{WHY[why]}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </form>

      <p id="skill-cost" className="text-xs font-normal text-white/60 tabular-nums">
        {skill ? `${skillCost(skill)} stamina · ${releaseTime(skill).toFixed(1)} s to release` : "Pick a Form"}
      </p>
    </div>
  );
}
