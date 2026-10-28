export const SKILL = {
  cost: { form: 3, element: 2, modifier: 1 },
  // Placeholder: each segment after the first multiplies the whole skill's cost by this.
  chainGrowth: 2,
  releaseTime: { base: 0.3, perWord: 0.1 },
};

export const FORMS = ["bolt", "beam", "nova", "imbue", "self"] as const;
export type Form = (typeof FORMS)[number];

export const ELEMENTS = ["fire", "water", "earth", "air", "lightning", "light", "darkness"] as const;
export type SkillElement = (typeof ELEMENTS)[number];

export const OPPOSITE: Partial<Record<SkillElement, SkillElement>> = {
  fire: "water", water: "fire", earth: "air", air: "earth", light: "darkness", darkness: "light",
};

export const MODIFIER_FITS = {
  amplify: FORMS,
  widen: ["beam", "nova"],
  pierce: ["bolt", "beam"],
  split: ["bolt"],
  extend: ["beam", "nova", "imbue", "self"],
  swift: ["bolt", "beam", "imbue"],
  delay: FORMS,
  follow: ["bolt"],
} as const satisfies Record<string, readonly Form[]>;
export type Modifier = keyof typeof MODIFIER_FITS;
export const MODIFIERS = Object.keys(MODIFIER_FITS) as Modifier[];

export type Word = Form | SkillElement | Modifier;
export const WORDS: readonly Word[] = [...FORMS, ...ELEMENTS, ...MODIFIERS];

export interface Segment {
  form: Form;
  elements: readonly SkillElement[];
  modifiers: readonly Modifier[];
}

export interface Skill {
  segments: readonly [Segment, ...Segment[]];
}

export const SKILLBOOK_PAGES = 4;
export type Skillbook = readonly (Skill | null)[];
export const blankSkillbook = (): Skillbook => Array.from({ length: SKILLBOOK_PAGES }, () => null);
export const SAVE_IN_FIGHT_TIME = 2;

const sameWords = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((word, i) => word === b[i]);

export const sameSkill = (a: Skill, b: Skill): boolean =>
  a.segments.length === b.segments.length && a.segments.every((s, i) => {
    const t = b.segments[i]!;
    return s.form === t.form && sameWords(s.elements, t.elements) && sameWords(s.modifiers, t.modifiers);
  });

export type Rejection = "not-learned" | "no-chaining" | "repeated" | "opposite" | "doesnt-fit";

export interface SkillProblem {
  segment: number;
  word: Word;
  /** Its index among the segment's words of its kind (the form is 0). */
  at: number;
  why: Rejection;
}

const isForm = (word: Word): word is Form => (FORMS as readonly Word[]).includes(word);
const isElement = (word: Word): word is SkillElement => (ELEMENTS as readonly Word[]).includes(word);

// `segment` holds only words already accepted; a Form word fills the segment's form box.
export function validateWord(
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
  return (MODIFIER_FITS[word] as readonly Form[]).includes(segment.form) ? null : "doesnt-fit";
}

export function validateSkill(skill: Skill, known: ReadonlySet<Word>): SkillProblem[] {
  const problems: SkillProblem[] = [];
  skill.segments.forEach((full, segment) => {
    const accepted = { form: full.form, elements: [] as SkillElement[], modifiers: [] as Modifier[] };
    const judge = <W extends Word>(word: W, at: number, keep: W[] | null) => {
      const why = validateWord(word, accepted, segment, known);
      if (why) problems.push({ segment, word, at, why });
      else keep?.push(word);
    };
    judge(full.form, 0, null);
    full.elements.forEach((element, at) => judge(element, at, accepted.elements));
    full.modifiers.forEach((modifier, at) => judge(modifier, at, accepted.modifiers));
  });
  return problems;
}

export function skillCost(skill: Skill, scale = 1): number {
  const { cost, chainGrowth } = SKILL;
  const words = skill.segments.reduce(
    (sum, { elements, modifiers }) => sum + cost.form + elements.length * cost.element + modifiers.length * cost.modifier,
    0,
  );
  return words * chainGrowth ** (skill.segments.length - 1) * scale;
}

export function releaseTime(skill: Skill): number {
  const words = skill.segments.reduce((sum, { elements, modifiers }) => sum + 1 + elements.length + modifiers.length, 0);
  return SKILL.releaseTime.base + SKILL.releaseTime.perWord * words;
}
