import {
  ELEMENTS, FORMS, validateWord, WORDS, type Modifier, type Form, type Rejection, type Segment, type Skill,
  type SkillElement, type Word,
} from "@infinite-tower/shared";

export interface ChantState {
  open: boolean;
  words: readonly Word[];
}

export const NO_CHANT: ChantState = { open: false, words: [] };

export type WordKind = "form" | "element" | "modifier";

export const kindOf = (word: Word): WordKind =>
  (FORMS as readonly Word[]).includes(word) ? "form" : (ELEMENTS as readonly Word[]).includes(word) ? "element"
    : "modifier";

const NEXT: Record<WordKind | "start", readonly WordKind[]> = {
  start: ["form"], form: ["element"], element: ["element", "modifier", "form"], modifier: ["modifier", "form"],
};

export function skillOf(words: readonly Word[]): Skill | null {
  const segments: Segment[] = [];
  for (const word of words) {
    const kind = kindOf(word);
    if (kind === "form") segments.push({ form: word as Form, elements: [], modifiers: [] });
    else if (kind === "element") (segments.at(-1)!.elements as SkillElement[]).push(word as SkillElement);
    else (segments.at(-1)!.modifiers as Modifier[]).push(word as Modifier);
  }
  const [first, ...rest] = segments;
  return first ? { segments: [first, ...rest] } : null;
}

export interface Choice {
  word: Word;
  why: Rejection | null;
}

export function choices(words: readonly Word[], known: ReadonlySet<Word>, query = ""): Choice[] {
  const last = words.at(-1);
  const kinds = NEXT[last ? kindOf(last) : "start"];
  const segments = skillOf(words)?.segments ?? [];
  const current = segments.at(-1);
  const find = query.trim().toLowerCase();
  return kinds.flatMap((kind) => WORDS.filter((word) => kindOf(word) === kind && known.has(word)))
    .filter((word) => word.includes(find))
    .map((word) => {
      const why = kindOf(word) === "form"
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

export const wordsOf = (skill: Skill): Word[] =>
  skill.segments.flatMap((s) => [s.form, ...s.elements, ...s.modifiers]);

export const wordTitle = (word: Word): string => word[0]!.toUpperCase() + word.slice(1);

export const skillText = (skill: Skill): string =>
  skill.segments.map((s) => [s.form, ...s.elements, ...s.modifiers].map(wordTitle).join(" ")).join(" → ");
