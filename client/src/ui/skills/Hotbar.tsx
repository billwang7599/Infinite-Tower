import { useGame } from "../context.js";
import { keyName } from "../keyNames.js";
import { useStore } from "../useStore.js";
import { skillText } from "./chant.js";

const PAGE_KEYS = ["skill1", "skill2", "skill3", "skill4"] as const;

export function Hotbar() {
  const { ui: { skills }, settings: { bindings } } = useGame();
  const book = useStore(skills, (s) => s.book);
  const keys = useStore(bindings, (s) => s.battle);
  return (
    <ol id="hotbar" className="absolute bottom-65 left-4 flex flex-col gap-1.5">
      {book.map((written, page) => (
        <li
          key={page} data-page={page}
          className={`flex w-32 flex-col rounded-sm border bg-black/55 px-2 py-1 ${
            written ? "border-victory/50" : "border-white/15 opacity-60"
          }`}
        >
          <span className="text-xs text-victory">{keyName(keys[PAGE_KEYS[page]!][0] ?? "")}</span>
          <span className="line-clamp-2 text-[11px]/tight font-normal">{written ? skillText(written) : "—"}</span>
        </li>
      ))}
    </ol>
  );
}
