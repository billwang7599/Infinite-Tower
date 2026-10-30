import type { Actions } from "../../core/actions.js";
import { LookPicture } from "../components/LookPicture.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { useAction } from "../components/useAction.js";
import type { DialogueState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

interface DialogueProps {
  dialogue: Store<DialogueState>;
  input: Actions;
  next: () => void;
  close: () => void;
}

export function Dialogue({ dialogue, input, next, close }: DialogueProps) {
  const open = useStore(dialogue, (s) => s.open);
  const name = useStore(dialogue, (s) => s.name);
  const look = useStore(dialogue, (s) => s.look);
  const text = useStore(dialogue, (s) => s.lines[s.line] ?? "");
  useAction(input, ["nextLine", "closeDialogue"], (action, repeat) => {
    if (repeat) return;
    if (action === "nextLine") next();
    else close();
  });
  if (!open) return null;
  return (
    <button
      type="button" id="dialogue" aria-label={`${name} says`} {...NO_FOCUS} onClick={next}
      className={
        "pointer-events-auto absolute bottom-5 left-1/2 flex min-h-32 w-[min(36rem,50%)] -translate-x-1/2 "
        + "cursor-pointer items-start gap-4 rounded-sm border border-victory/40 bg-night p-4 text-left font-ui "
        + "text-white shadow-[0_12px_40px_#000a]"
      }
    >
      {look && <LookPicture look={look} view="portrait" className="size-24 shrink-0 rounded-sm bg-black/40" />}
      <div className="flex flex-col gap-1.5">
        <div id="dialogue-name" className="font-title text-lg tracking-[0.08em] text-victory">{name}</div>
        <p id="dialogue-line" className="text-base/snug">{text}</p>
      </div>
    </button>
  );
}
