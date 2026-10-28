import type { KeyBindings } from "../../settings/bindings.js";
import { keyName } from "../keyNames.js";
import type { SpellsState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { spellText } from "./chant.js";

const PAGE_KEYS = ["spell1", "spell2", "spell3", "spell4"] as const;

export function Hotbar({ spells, bindings }: { spells: Store<SpellsState>; bindings: KeyBindings }) {
  const book = useStore(spells, (s) => s.book);
  const keys = useStore(bindings, (s) => s.battle);
  return (
    <ol id="hotbar" className="absolute bottom-24 left-4 flex flex-col gap-1.5">
      {book.map((written, page) => (
        <li
          key={page} data-page={page}
          className={`flex w-32 flex-col rounded-sm border bg-black/55 px-2 py-1 ${
            written ? "border-victory/50" : "border-white/15 opacity-60"
          }`}
        >
          <span className="text-xs text-victory">{keyName(keys[PAGE_KEYS[page]!][0] ?? "")}</span>
          <span className="line-clamp-2 text-[11px]/tight font-normal">{written ? spellText(written) : "—"}</span>
        </li>
      ))}
    </ol>
  );
}
