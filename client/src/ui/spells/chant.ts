import {
  ELEMENTS, FORMS, rejectWord, WORDS, type Augment, type Form, type Rejection, type Segment, type Spell,
  type SpellElement, type Word,
} from "@infinite-tower/shared";

export interface ChantState {
  open: boolean;
  words: readonly Word[];
}

export const NO_CHANT: ChantState = { open: false, words: [] };

export type WordKind = "form" | "element" | "augment";

export const kindOf = (word: Word): WordKind =>
  (FORMS as readonly Word[]).includes(word) ? "form" : (ELEMENTS as readonly Word[]).includes(word) ? "element"
    : "augment";

const NEXT: Record<WordKind | "start", readonly WordKind[]> = {
  start: ["form"], form: ["element"], element: ["element", "augment", "form"], augment: ["augment", "form"],
};

export function spellOf(words: readonly Word[]): Spell | null {
  const segments: Segment[] = [];
  for (const word of words) {
    const kind = kindOf(word);
    if (kind === "form") segments.push({ form: word as Form, elements: [], augments: [] });
    else if (kind === "element") (segments.at(-1)!.elements as SpellElement[]).push(word as SpellElement);
    else (segments.at(-1)!.augments as Augment[]).push(word as Augment);
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
  const segments = spellOf(words)?.segments ?? [];
  const current = segments.at(-1);
  const find = query.trim().toLowerCase();
  return kinds.flatMap((kind) => WORDS.filter((word) => kindOf(word) === kind && known.has(word)))
    .filter((word) => word.includes(find))
    .map((word) => {
      const why = kindOf(word) === "form"
        ? rejectWord(word, { form: word as Form, elements: [], augments: [] }, segments.length, known)
        : rejectWord(word, current!, segments.length - 1, known);
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

export const wordsOf = (spell: Spell): Word[] =>
  spell.segments.flatMap((s) => [s.form, ...s.elements, ...s.augments]);

export const wordTitle = (word: Word): string => word[0]!.toUpperCase() + word.slice(1);

export const spellText = (spell: Spell): string =>
  spell.segments.map((s) => [s.form, ...s.elements, ...s.augments].map(wordTitle).join(" ")).join(" → ");
