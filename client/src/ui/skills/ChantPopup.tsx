import { SAVE_IN_FIGHT_TIME, type Skill, type Word } from "@infinite-tower/shared";
import { useMemo } from "react";
import type { Actions } from "../../core/actions.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import type { BattleHudState, SkillsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { addWord, NO_CHANT, skillOf, skillText, undoWord, type ChantState } from "./chant.js";
import { SkillBuilder } from "./SkillBuilder.js";

interface ChantProps {
  chant: Store<ChantState>;
  skills: Store<SkillsState>;
  hud: Store<BattleHudState>;
  input: Actions;
  cast: (skill: Skill) => void;
  save: (page: number, skill: Skill) => void;
}

export function ChantPopup({ chant, skills, hud, input, cast, save }: ChantProps) {
  const open = useStore(chant, (s) => s.open);
  const words = useStore(chant, (s) => s.words);
  const writingPage = useStore(hud, (s) => s.writingPage);
  const knownWords = useStore(skills, (s) => s.known);
  const book = useStore(skills, (s) => s.book);
  const inHand = useStore(hud, (s) => s.skillbookInHand);
  const fighting = useStore(hud, (s) => s.result === "fighting");
  const known = useMemo(() => new Set<Word>(knownWords), [knownWords]);
  const skill = skillOf(words);

  const busy = writingPage !== null;
  const releaseNow = () => {
    if (!skill || busy) return;
    cast(skill);
    chant.set(NO_CHANT);
  };

  useAction(input, ["chant", "closeChant", "releaseChant"], (action, repeat) => {
    if (!open) {
      if (action !== "chant") return false;
      if (!repeat && inHand && fighting) chant.set({ open: true });
      return;
    }
    if (action === "releaseChant") releaseNow();
    else if (!repeat) chant.set({ open: false });
  });

  if (!open) return null;
  return (
    <section
      id="chant" aria-label="Chant"
      className={
        "pointer-events-auto absolute top-1/2 left-1/2 w-[min(640px,88%)] -translate-x-1/2 -translate-y-1/2 "
        + "rounded-sm border border-white/15 bg-night/75 px-6 py-5 font-normal shadow-[0_12px_40px_#000a]"
      }
    >
      <h2 className="mb-2 text-center font-title text-2xl tracking-[0.12em] text-victory">Chant</h2>
      <SkillBuilder
        words={words} known={known} input={input} busy={busy}
        pick={(word) => chant.set(addWord(chant.get(), word, known))} undo={() => chant.set(undoWord(chant.get()))}
      />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button" id="chant-release" {...NO_FOCUS} disabled={!skill || busy} onClick={releaseNow}
          className={`pointer-events-auto ${BUTTON.primary}`}
        >
          Release
        </button>
        {book.map((written, page) => (
          <button
            type="button" key={page} {...NO_FOCUS} data-page={page} disabled={!skill || busy}
            title={written ? skillText(written) : "Blank"} onClick={() => skill && save(page, skill)}
            className={`pointer-events-auto ${BUTTON.plain}`}
          >
            Write on page {page + 1}
          </button>
        ))}
      </div>
      {busy && (
        <div id="chant-writing" className="mt-3 text-center text-xs text-white/70">
          Writing on page {writingPage + 1}…
          <div className="mt-1 h-1.5 bg-white/10">
            <div
              className="h-full origin-left animate-page-fill bg-victory"
              style={{ animationDuration: `${SAVE_IN_FIGHT_TIME}s` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
