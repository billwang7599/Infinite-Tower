import { skillOf, wordsOf, type Word } from "@infinite-tower/shared";
import { useMemo, useState } from "react";
import { CloseButton } from "../components/CloseButton.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON, PANEL_HEAD, PANEL_TITLE } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { useGame } from "../context.js";
import { useStore } from "../useStore.js";
import { NO_CHANT, skillText, type ChantState } from "./chant.js";
import { SkillBuilder } from "./SkillBuilder.js";

const PAGE = "flex h-16 w-full cursor-pointer flex-col border-l-3 bg-pit/50 px-2 py-1 text-left inset-ring";
const PAGE_IDLE = "border-bone/35 inset-ring-bone/16 hover:bg-bone/5";

export function SkillbookScreen({ writingPage = null }: { writingPage?: number | null }) {
  const { ui: { skills, skillbookScreen }, input, actions: { saveSkill: save } } = useGame();
  const close = () => skillbookScreen.set({ open: false });
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
        + "cut-14 engraved px-7 py-6 font-normal"
      }
    >
      <header className={`mb-3 ${PANEL_HEAD}`}>
        <h2 className={PANEL_TITLE}>Skillbook</h2>
        <CloseButton close={close} />
      </header>
      <ol className="mb-4 grid grid-cols-4 gap-2">
        {book.map((written, i) => (
          <li key={i}>
            <button
              type="button" {...NO_FOCUS} data-page={i} onClick={() => turnTo(i)}
              className={`${PAGE} ${i === page ? "border-cinnabar inset-ring-cinnabar/50" : PAGE_IDLE}`}
            >
              <span className="text-xs text-verdigris">Page {i + 1}</span>
              <span className="line-clamp-2 text-xs">{written ? skillText(written) : "Blank"}</span>
            </button>
          </li>
        ))}
      </ol>
      {known.size === 0
        ? <p className="text-center text-sm text-bone/60">You don't know any words yet.</p>
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
        <p id="skillbook-writing" className="mt-3 text-center text-xs text-bone/70">
          Writing on page {writingPage + 1}…
        </p>
      )}
    </section>
  );
}
