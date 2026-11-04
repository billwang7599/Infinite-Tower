import { MAX_CHAT_CHARS } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import { TEXT_INPUT } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { keyName } from "../keyNames.js";
import { useGame } from "../context.js";
import { useStore } from "../useStore.js";

const CLOSED_LINES = 3;

export function Chat() {
  const { ui: { chat }, input, settings: { bindings }, actions } = useGame();
  const send = (text: string) => actions.request({ t: "chat", text });
  const open = useStore(chat, (s) => s.open);
  const focused = useStore(chat, (s) => s.focused);
  const lines = useStore(chat, (s) => s.lines);
  const openKey = useStore(bindings, (s) => s.general.openChat[0]);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLInputElement>(null);

  useAction(input, ["openChat", "sendChat", "closeChat"], (action, repeat) => {
    if (action === "openChat") {
      if (!repeat) {
        chat.set({ open: true });
        box.current?.focus();
      }
      return;
    }
    if (action === "sendChat" && draft.trim() !== "") send(draft.trim());
    setDraft("");
    chat.set({ open: false, focused: false });
  });

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, open]);

  const first = open ? 0 : Math.max(0, lines.length - CLOSED_LINES);
  return (
    <div
      id="chat"
      className={
        "pointer-events-none absolute bottom-45 left-4 flex w-[min(26rem,40%)] flex-col gap-1 text-sm font-normal "
        + "text-bone text-shadow-hud"
      }
    >
      {lines.length > first && (
        <ol
          ref={log}
          className={`px-2 py-1 ${
            open ? "pointer-events-auto max-h-60 overflow-y-auto bg-stone/88" : ""
          }`}
        >
          {lines.slice(first).map((line, i) => (
            <li key={first + i} data-chat-line className={open ? "wrap-break-word" : "truncate"}>
              <span className="font-semibold text-verdigris">{line.from}:</span> {line.text}
            </li>
          ))}
        </ol>
      )}
      {/* enterKeyHint="send" lets its Enter through the keyboard to the chat's layer */}
      {open && (
        <div className="pointer-events-auto relative">
          <input
            ref={box} id="chat-input" aria-label="Chat message" placeholder="Say something" autoFocus
            autoComplete="off" enterKeyHint="send" maxLength={MAX_CHAT_CHARS} value={draft}
            onChange={(e) => setDraft(e.target.value)} onFocus={() => chat.set({ focused: true })}
            onBlur={() => chat.set({ focused: false })}
            className={`w-full ${TEXT_INPUT} ${focused ? "" : "pr-32 opacity-50"}`}
          />
          {!focused && openKey && (
            <span
              id="chat-cue"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-bone/80"
            >
              Press {keyName(openKey)} to chat
            </span>
          )}
        </div>
      )}
    </div>
  );
}
