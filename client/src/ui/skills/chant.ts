import {
  NEXT_WORDS, skillOf, validateWord, wordKind, WORDS, type Form, type Rejection, type Skill, type Word,
} from "@infinite-tower/shared";

export interface ChantState {
  open: boolean;
  words: readonly Word[];
}

export const NO_CHANT: ChantState = { open: false, words: [] };

export interface Choice {
  word: Word;
  why: Rejection | null;
}

export function choices(words: readonly Word[], known: ReadonlySet<Word>, query = ""): Choice[] {
  const last = words.at(-1);
  const kinds = NEXT_WORDS[last ? wordKind(last) : "start"];
  const segments = skillOf(words)?.segments ?? [];
  const current = segments.at(-1);
  const find = query.trim().toLowerCase();
  return kinds.flatMap((kind) => WORDS.filter((word) => wordKind(word) === kind && known.has(word)))
    .filter((word) => word.includes(find))
    .map((word) => {
      const why = wordKind(word) === "form"
        ? validateWord(word, { form: word as Form, elements: [], modifiers: [] }, segments.length, known)
        : validateWord(word, current!, segments.length - 1, known);
      return { word, why };
    });
}

export const quickPick = (listed: readonly Choice[], n: number): Word | null =>
  listed.filter((c) => c.why === null)[n - 1]?.word ?? null;

export function addWord(chant: ChantState, word: Word, known: ReadonlySet<Word>): ChantState {
  const fits = choices(chant.words, known).some((c) => c.word === word && c.why === null);
  return fits ? { ...chant, words: [...chant.words, word] } : chant;
}

export const undoWord = (chant: ChantState): ChantState => ({ ...chant, words: chant.words.slice(0, -1) });

export const wordTitle = (word: Word): string => word[0]!.toUpperCase() + word.slice(1);

export const skillText = (skill: Skill): string =>
  skill.segments.map((s) => [s.form, ...s.elements, ...s.modifiers].map(wordTitle).join(" ")).join(" → ");
