import { MAX_CHAT_CHARS } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import type { Actions } from "../../core/actions.js";
import { TEXT_INPUT } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import type { ChatState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

const CLOSED_LINES = 3;

interface ChatProps {
  chat: Store<ChatState>;
  input: Actions;
  send: (text: string) => void;
}

export function Chat({ chat, input, send }: ChatProps) {
  const open = useStore(chat, (s) => s.open);
  const lines = useStore(chat, (s) => s.lines);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLOListElement>(null);

  useAction(input, ["openChat", "sendChat", "closeChat"], (action, repeat) => {
    if (action === "openChat") {
      if (!repeat) chat.set({ open: true });
      return;
    }
    if (action === "sendChat" && draft.trim() !== "") send(draft.trim());
    setDraft("");
    chat.set({ open: false });
  });

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, open]);

  const first = open ? 0 : Math.max(0, lines.length - CLOSED_LINES);
  return (
    <div
      id="chat"
      className={
        "pointer-events-none absolute bottom-24 left-4 flex w-[min(26rem,40%)] flex-col gap-1 font-ui text-sm "
        + "text-white text-shadow-hud"
      }
    >
      {lines.length > first && (
        <ol
          ref={log}
          className={`rounded-sm px-2 py-1 ${
            open ? "pointer-events-auto max-h-60 overflow-y-auto bg-black/70" : "bg-black/35"
          }`}
        >
          {lines.slice(first).map((line, i) => (
            <li key={first + i} data-chat-line className={open ? "wrap-break-word" : "truncate"}>
              <span className="font-semibold text-victory">{line.from}:</span> {line.text}
            </li>
          ))}
        </ol>
      )}
      {/* enterKeyHint="send" lets its Enter through the keyboard to the chat's layer */}
      {open && (
        <input
          id="chat-input" aria-label="Chat message" placeholder="Say something" autoFocus autoComplete="off"
          enterKeyHint="send" maxLength={MAX_CHAT_CHARS} value={draft} onChange={(e) => setDraft(e.target.value)}
          className={`pointer-events-auto ${TEXT_INPUT}`}
        />
      )}
    </div>
  );
}
