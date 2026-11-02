import { skillOf, wordsOf, type Skill, type Word } from "@infinite-tower/shared";
import { useMemo, useState } from "react";
import type { Actions } from "../../core/actions.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import type { SkillsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { NO_CHANT, skillText, type ChantState } from "./chant.js";
import { SkillBuilder } from "./SkillBuilder.js";

interface BookProps {
  skills: Store<SkillsState>;
  input: Actions;
  save: (page: number, skill: Skill) => void;
  close: () => void;
  writingPage?: number | null;
}

export function SkillbookScreen({ skills, input, save, close, writingPage = null }: BookProps) {
  const book = useStore(skills, (s) => s.book);
  const knownWords = useStore(skills, (s) => s.known);
  const known = useMemo(() => new Set<Word>(knownWords), [knownWords]);
  const [page, setPage] = useState(0);
  const [chant, setChant] = useState<ChantState>({ ...NO_CHANT, words: book[0] ? wordsOf(book[0]) : [] });
  const skill = skillOf(chant.words);
  const write = () => { if (skill && writingPage === null) save(page, skill); };
  const turnTo = (to: number) => {
    setPage(to);
    setChant({ ...NO_CHANT, words: book[to] ? wordsOf(book[to]) : [] });
  };

  useAction(input, ["writePage", "closeSkillbook"], (action) => {
    if (action === "writePage") write();
    else close();
  });

  return (
    <section
      id="skillbook" aria-label="Skillbook"
      className={
        "pointer-events-auto absolute top-1/2 left-1/2 w-[min(720px,90%)] -translate-x-1/2 -translate-y-1/2 max-h-[calc(100%-2rem)] overflow-y-auto "
        + "rounded-sm border border-white/15 bg-night/95 px-6 py-5 font-normal shadow-[0_12px_40px_#000a]"
      }
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-title text-2xl tracking-[0.12em] text-victory">Skillbook</h2>
        <button
          type="button" aria-label="Close" {...NO_FOCUS} onClick={close}
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-white/60 hover:bg-white/10"
        >
          ✕
        </button>
      </header>
      <ol className="mb-4 grid grid-cols-4 gap-2">
        {book.map((written, i) => (
          <li key={i}>
            <button
              type="button" {...NO_FOCUS} data-page={i} onClick={() => turnTo(i)}
              className={`flex h-16 w-full cursor-pointer flex-col rounded-sm border px-2 py-1 text-left ${
                i === page ? "border-victory bg-victory/10" : "border-white/15 hover:bg-white/5"
              }`}
            >
              <span className="text-xs text-victory">Page {i + 1}</span>
              <span className="line-clamp-2 text-xs">{written ? skillText(written) : "Blank"}</span>
            </button>
          </li>
        ))}
      </ol>
      {known.size === 0
        ? <p className="text-center text-sm text-white/60">You don't know any words yet.</p>
        : (
          <SkillBuilder chant={chant} known={known} input={input} change={setChant} />
        )}
      <div className="mt-4 flex justify-center">
        <button
          type="button" id="skillbook-write" {...NO_FOCUS} disabled={!skill || writingPage !== null} onClick={write}
          className={`pointer-events-auto ${BUTTON.primary}`}
        >
          Write on page {page + 1}
        </button>
      </div>
      {writingPage !== null && (
        <p id="skillbook-writing" className="mt-3 text-center text-xs text-white/70">
          Writing on page {writingPage + 1}…
        </p>
      )}
    </section>
  );
}
