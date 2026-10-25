/** Rules for a name typed into a form. The form says them up front; the server enforces them (text-schema.ts). */
export interface TextRules {
  min: number;
  max: number;
  /** Also an HTML pattern attribute, which uses the `v` flag: hence an escaped `-`. */
  pattern: string;
  /** The characters `pattern` allows, in words. */
  allowed: string;
}

/** e.g. "3-20 letters, digits, _ or -" */
export const rulesHint = (rules: TextRules): string => `${rules.min}-${rules.max} ${rules.allowed}`;
