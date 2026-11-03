import {
  NEXT_WORDS, skillOf, validateWord, wordKind, WORDS, type Form, type Rejection, type Skill, type Word, type WordKind,
} from "@infinite-tower/shared";

export interface ChantState {
  open: boolean;
  words: readonly Word[];
  kind: WordKind | null; // whose words the number keys pick; null: they pick a kind
}

export const NO_CHANT: ChantState = { open: false, words: [], kind: null };

export const KINDS: readonly WordKind[] = ["form", "element", "modifier"];

interface Choice {
  word: Word;
  why: Rejection | null;
}

export function choices(
  words: readonly Word[], known: ReadonlySet<Word>, query = "", only: WordKind | null = null,
): Choice[] {
  const last = words.at(-1);
  const next = NEXT_WORDS[last ? wordKind(last) : "start"];
  const segments = skillOf(words)?.segments ?? [];
  const current = segments.at(-1);
  const find = query.trim().toLowerCase();
  return KINDS.filter((kind) => next.includes(kind) && (only === null || kind === only))
    .flatMap((kind) => WORDS.filter((word) => wordKind(word) === kind && known.has(word)))
    .filter((word) => word.includes(find))
    .map((word) => {
      const why = wordKind(word) === "form"
        ? validateWord(word, { form: word as Form, elements: [], modifiers: [] }, segments.length, known)
        : validateWord(word, current!, segments.length - 1, known);
      return { word, why };
    });
}

export const kindOpen = (words: readonly Word[], known: ReadonlySet<Word>, kind: WordKind): boolean =>
  choices(words, known, "", kind).length > 0;

export const openKind = (chant: ChantState, kind: WordKind, known: ReadonlySet<Word>): ChantState =>
  kindOpen(chant.words, known, kind) ? { ...chant, kind } : chant;

export function numbered(chant: ChantState, known: ReadonlySet<Word>, query: string): Choice[] {
  if (query.trim() !== "") return choices(chant.words, known, query);
  return chant.kind ? choices(chant.words, known, "", chant.kind) : [];
}

export function pickNumber(chant: ChantState, n: number, known: ReadonlySet<Word>, query = ""): ChantState {
  if (chant.kind === null && query.trim() === "") {
    const kind = KINDS[n - 1];
    return kind ? openKind(chant, kind, known) : chant;
  }
  const choice = numbered(chant, known, query)[n - 1];
  return choice?.why === null ? addWord(chant, choice.word, known) : chant;
}

export function addWord(chant: ChantState, word: Word, known: ReadonlySet<Word>): ChantState {
  const fits = choices(chant.words, known).some((c) => c.word === word && c.why === null);
  return fits ? { ...chant, words: [...chant.words, word], kind: null } : chant;
}

export const back = (chant: ChantState): ChantState =>
  chant.kind ? { ...chant, kind: null } : { ...chant, words: chant.words.slice(0, -1) };

export const wordTitle = (word: Word): string => word[0]!.toUpperCase() + word.slice(1);

export const skillText = (skill: Skill): string =>
  skill.segments.map((s) => [s.form, ...s.elements, ...s.modifiers].map(wordTitle).join(" ")).join(" → ");
