import { MAX_CHAT_CHARS } from "@infinite-tower/shared";
import { useEffect, useRef, useState } from "react";
import { TEXT_INPUT } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { keyName } from "../keyNames.js";
import { useGame } from "../context.js";
import { act, outletOf } from "../screens/admin/admin.js";
import { useStore } from "../useStore.js";
import { parseCommand, suggest, type Suggestions } from "./commands.js";

const CLOSED_LINES = 3;
const NO_SUGGESTIONS: Suggestions = { usage: null, options: [] };

export function Chat({ commands }: { commands: boolean }) {
  const game = useGame();
  const { ui, input, settings: { bindings }, actions } = game;
  const { chat } = ui;
  const open = useStore(chat, (s) => s.open);
  const focused = useStore(chat, (s) => s.focused);
  const lines = useStore(chat, (s) => s.lines);
  const openKey = useStore(bindings, (s) => s.general.openChat[0]);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState(0);
  const log = useRef<HTMLOListElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const pickedRow = useRef<HTMLLIElement>(null);
  const { usage, options } = commands && focused ? suggest(draft) : NO_SUGGESTIONS;

  const edit = (text: string) => {
    setDraft(text);
    setPicked(0);
  };
  const note = (texts: readonly string[], error = false) => ui.hearChat(texts.map((text) => ({ note: text, error })));

  // false: it stays open with what was typed, to fix it.
  const runCommand = (text: string): boolean => {
    if (!commands) {
      note(["Commands work on dev servers only."], true);
      return false;
    }
    const { battle, admin, screen } = ui, fight = battle.get(), toggles = admin.get();
    const parsed = parseCommand(text, {
      mode: screen.get().mode, againstEnemies: fight.result === "fighting" && !fight.duel,
      invulnerable: toggles.invulnerable, keepInventory: toggles.keepInventory,
    });
    if ("error" in parsed) {
      note([parsed.error], true);
      return false;
    }
    if ("help" in parsed) {
      note(parsed.help);
      edit("");
      return false;
    }
    act(outletOf(game), parsed.act);
    note([parsed.done]);
    return true;
  };

  useAction(input, ["openChat", "sendChat", "closeChat"], (action, repeat) => {
    if (action === "openChat") {
      if (!repeat) {
        chat.set({ open: true });
        if (commands && draft === "") edit("/");
        box.current?.focus();
      }
      return;
    }
    const text = draft.trim();
    if (action === "sendChat" && text.startsWith("/")) {
      if (!runCommand(text)) return;
    } else if (action === "sendChat" && text !== "") {
      actions.request({ t: "chat", text });
    }
    edit("");
    chat.set({ open: false, focused: false });
  });

  useAction(input, ["takeSuggestion", "nextSuggestion", "previousSuggestion"], (action) => {
    if (options.length === 0) return false;
    if (action === "takeSuggestion") edit(options[picked]?.text ?? draft);
    else setPicked((options.length + picked + (action === "nextSuggestion" ? 1 : -1)) % options.length);
  });

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, open]);
  useEffect(() => {
    pickedRow.current?.scrollIntoView({ block: "nearest" });
  }, [picked]);

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
              {"note" in line ? (
                <span data-chat-note={line.error ? "error" : "ok"}
                  className={line.error ? "text-error" : "text-bone/65"}>
                  {line.note}
                </span>
              ) : (
                <><span className="font-semibold text-verdigris">{line.from}:</span> {line.text}</>
              )}
            </li>
          ))}
        </ol>
      )}
      {(usage !== null || options.length > 0) && (
        <div id="chat-suggestions" className="pointer-events-auto bg-stone py-1 text-xs">
          {usage !== null && <p id="chat-usage" className="px-2 py-0.5 text-bone/50">{usage}</p>}
          {options.length > 0 && (
            <ul role="listbox" className="max-h-40 overflow-y-auto">
              {options.map((option, i) => (
                <li
                  key={option.text} ref={i === picked ? pickedRow : undefined} role="option"
                  aria-selected={i === picked} data-suggestion={option.text}
                  onMouseDown={(e) => { e.preventDefault(); edit(option.text); }}
                  className={`flex cursor-pointer justify-between gap-3 px-2 py-0.5 ${
                    i === picked ? "bg-cinnabar/20 text-bone" : "text-bone/70 hover:bg-bone/6"
                  }`}
                >
                  <span>{option.label}</span>
                  {option.detail && <span className="truncate text-bone/45">{option.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* enterKeyHint="send" lets its Enter and Tab through the keyboard to the chat's layer */}
      {open && (
        <div className="pointer-events-auto relative">
          <input
            ref={box} id="chat-input" aria-label="Chat message" placeholder="Say something" autoFocus
            autoComplete="off" enterKeyHint="send" maxLength={MAX_CHAT_CHARS} value={draft}
            onChange={(e) => edit(e.target.value)} onFocus={() => chat.set({ focused: true })}
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
