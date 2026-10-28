export const SPELL = {
  cost: { form: 3, element: 2, augment: 1 },
  // Placeholder: each segment after the first multiplies the whole spell's cost by this.
  chainGrowth: 2,
  castTime: { base: 0.3, perWord: 0.1 },
};

export const FORMS = ["bolt", "beam", "nova", "imbue", "self"] as const;
export type Form = (typeof FORMS)[number];

export const ELEMENTS = ["fire", "water", "earth", "air", "lightning", "light", "darkness"] as const;
export type SpellElement = (typeof ELEMENTS)[number];

export const OPPOSITE: Partial<Record<SpellElement, SpellElement>> = {
  fire: "water", water: "fire", earth: "air", air: "earth", light: "darkness", darkness: "light",
};

export const AUGMENT_FITS = {
  amplify: FORMS,
  widen: ["beam", "nova"],
  pierce: ["bolt", "beam"],
  split: ["bolt"],
  extend: ["beam", "nova", "imbue", "self"],
  swift: ["bolt", "beam", "imbue"],
  delay: FORMS,
  follow: ["bolt"],
} as const satisfies Record<string, readonly Form[]>;
export type Augment = keyof typeof AUGMENT_FITS;
export const AUGMENTS = Object.keys(AUGMENT_FITS) as Augment[];

export type Word = Form | SpellElement | Augment;
export const WORDS: readonly Word[] = [...FORMS, ...ELEMENTS, ...AUGMENTS];

export interface Segment {
  form: Form;
  elements: readonly SpellElement[];
  augments: readonly Augment[];
}

export interface Spell {
  segments: readonly [Segment, ...Segment[]];
}

export type Rejection = "not-learned" | "no-chaining" | "repeated" | "opposite" | "doesnt-fit";

export interface SpellProblem {
  segment: number;
  word: Word;
  /** Its index among the segment's words of its kind (the form is 0). */
  at: number;
  why: Rejection;
}

const isForm = (word: Word): word is Form => (FORMS as readonly Word[]).includes(word);
const isElement = (word: Word): word is SpellElement => (ELEMENTS as readonly Word[]).includes(word);

// `segment` holds only words already accepted; a Form word fills the segment's form box.
export function rejectWord(
  word: Word, segment: Segment, segmentIndex: number, known: ReadonlySet<Word>,
): Rejection | null {
  if (!known.has(word)) return "not-learned";
  if (isForm(word)) {
    const formsKnown = FORMS.filter((form) => known.has(form)).length;
    return segmentIndex > 0 && formsKnown < 2 ? "no-chaining" : null;
  }
  if (isElement(word)) {
    if (segment.elements.includes(word)) return "repeated";
    const opposite = OPPOSITE[word];
    return opposite && segment.elements.includes(opposite) ? "opposite" : null;
  }
  return (AUGMENT_FITS[word] as readonly Form[]).includes(segment.form) ? null : "doesnt-fit";
}

export function spellProblems(spell: Spell, known: ReadonlySet<Word>): SpellProblem[] {
  const problems: SpellProblem[] = [];
  spell.segments.forEach((full, segment) => {
    const accepted = { form: full.form, elements: [] as SpellElement[], augments: [] as Augment[] };
    const judge = <W extends Word>(word: W, at: number, keep: W[] | null) => {
      const why = rejectWord(word, accepted, segment, known);
      if (why) problems.push({ segment, word, at, why });
      else keep?.push(word);
    };
    judge(full.form, 0, null);
    full.elements.forEach((element, at) => judge(element, at, accepted.elements));
    full.augments.forEach((augment, at) => judge(augment, at, accepted.augments));
  });
  return problems;
}

export function spellCost(spell: Spell, scale = 1): number {
  const { cost, chainGrowth } = SPELL;
  const words = spell.segments.reduce(
    (sum, { elements, augments }) => sum + cost.form + elements.length * cost.element + augments.length * cost.augment,
    0,
  );
  return words * chainGrowth ** (spell.segments.length - 1) * scale;
}

export function castTime(spell: Spell): number {
  const words = spell.segments.reduce((sum, { elements, augments }) => sum + 1 + elements.length + augments.length, 0);
  return SPELL.castTime.base + SPELL.castTime.perWord * words;
}
