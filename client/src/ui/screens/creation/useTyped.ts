/** Text typed out a character at a time, as the System speaks. Starts over whenever `text` changes. */
import { useEffect, useState } from "react";

const MS_PER_CHAR = 26;

export interface Typed {
  shown: string;
  done: boolean;
  /** Show the rest at once. */
  finish: () => void;
}

/** `instant` (reduced motion) shows each line whole. */
export function useTyped(text: string, instant: boolean): Typed {
  const [typed, setTyped] = useState({ text, count: instant ? text.length : 0 });
  // A new line: start it over (while rendering, so the old line's end never shows with the new text).
  const current = typed.text === text ? typed : { text, count: instant ? text.length : 0 };
  if (current !== typed) setTyped(current);

  const done = current.count >= text.length;
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setTyped((t) => ({ ...t, count: t.count + 1 })), MS_PER_CHAR);
    return () => clearInterval(timer);
  }, [text, done]);

  return { shown: text.slice(0, current.count), done, finish: () => setTyped({ text, count: text.length }) };
}
