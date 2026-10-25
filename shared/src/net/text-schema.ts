/** Zod for `TextRules` (text-rules.ts). Server-side only, like every Zod schema: kept out of the package index. */
import { z } from "zod";
import { rulesHint, type TextRules } from "./text-rules.js";

/** A trimmed string held to `rules`, failing with e.g. "Usernames are 3-20 letters, digits, _ or -." */
export function ruledText(rules: TextRules, noun: string) {
  const help = `${noun} are ${rulesHint(rules)}.`;
  return z.string().trim().min(rules.min, help).max(rules.max, help).regex(new RegExp(rules.pattern), help);
}
