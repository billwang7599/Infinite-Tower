/**
 * Every key binding, one row per action, grouped by mode. Click a key to change it (the next key pressed
 * takes its place; Esc cancels), + to add one, × to drop one. Mouse buttons are fixed and only shown.
 */
import { useEffect, useState } from "react";
import {
  actionDef, actionsOf, GROUPS, isBindable, keysOf, MAX_KEYS, sameAction,
  type ActionRef, type BindResult, type Group, type KeyBindings,
} from "../../../settings/bindings.js";
import { keyName, mouseName } from "../../keyNames.js";
import { useStore } from "../../useStore.js";
import { BUTTON } from "./buttons.js";

const GROUP_TITLES: Record<Group, string> = { field: "Field", battle: "Battle" };

/** The slot waiting for a key: an action, and which of its keys to replace (null: add one). */
interface Waiting {
  action: ActionRef;
  replace: string | null;
}

export function KeyBindingsList({ bindings }: { bindings: KeyBindings }) {
  const map = useStore(bindings, (s) => s);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!waiting) return;
    // Capture phase, stopped there: the key is for this slot only (Esc must not also close the settings).
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || (!isBindable(e.code) && e.code !== "Escape")) return;
      setWaiting(null);
      if (e.code !== "Escape") setNotice(describe(bindings.bind(waiting.action, e.code, waiting.replace), e.code, waiting.action));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [waiting, bindings]);

  const wait = (action: ActionRef, replace: string | null) => {
    setNotice("");
    setWaiting({ action, replace });
  };
  const reset = () => {
    bindings.reset();
    setWaiting(null);
    setNotice("Back to the default keys.");
  };

  return (
    <div id="key-bindings" className="min-h-0 flex-1 overflow-y-auto px-7">
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-lg font-semibold">Key bindings</h3>
        <button type="button" disabled={bindings.isDefault()} onClick={reset} className={BUTTON.plain}>Reset to defaults</button>
      </div>
      {GROUPS.map((group) => (
        <section key={group} className="mt-4">
          <h4 className="mb-1 text-xs tracking-[0.3em] text-white/45 uppercase">{GROUP_TITLES[group]}</h4>
          {actionsOf(group).map((action, _, all) => (
            <BindingRow
              key={action.action}
              action={action}
              mouseColumn={all.some((a) => actionDef(a).mouse)}
              keys={keysOf(map, action)}
              waitingFor={waiting && sameAction(waiting.action, action) ? waiting.replace : undefined}
              wait={(replace) => wait(action, replace)}
              unbind={(key) => bindings.unbind(action, key)}
            />
          ))}
        </section>
      ))}
      <p aria-live="polite" className="sticky bottom-0 min-h-10 bg-night py-2.5 text-sm text-victory">{notice}</p>
    </div>
  );
}

interface RowProps {
  action: ActionRef;
  /** Some action in this group has mouse buttons: every row keeps the column, so the keys line up. */
  mouseColumn: boolean;
  keys: readonly string[];
  /** undefined: not waiting here. A key: waiting to replace it. null: waiting to add one. */
  waitingFor: string | null | undefined;
  wait: (replace: string | null) => void;
  unbind: (key: string) => void;
}

function BindingRow({ action, mouseColumn, keys, waitingFor, wait, unbind }: RowProps) {
  const def = actionDef(action);
  return (
    <div data-action={`${action.group}.${action.action}`} className="flex min-h-10 items-center justify-between gap-4 border-b border-white/5 py-1">
      <span className="text-[15px] text-white/85">{def.label}</span>
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        {keys.map((key) =>
          waitingFor === key ? (
            <PressAKey key={key} />
          ) : (
            <KeyChip key={key} code={key} change={() => wait(key)} remove={keys.length > 1 ? () => unbind(key) : null} />
          ),
        )}
        {waitingFor === null ? (
          <PressAKey />
        ) : (
          keys.length < MAX_KEYS && (
            <button
              type="button"
              aria-label={`Add a key for ${def.label}`}
              onClick={() => wait(null)}
              className="h-7 w-7 cursor-pointer rounded-sm border border-dashed border-white/25 text-white/45 transition-colors hover:border-white/60 hover:text-white"
            >
              +
            </button>
          )
        )}
        {mouseColumn && <span className="ml-1 w-22 text-right text-xs text-white/45">{def.mouse?.map(mouseName).join(" / ")}</span>}
      </span>
    </div>
  );
}

function KeyChip({ code, change, remove }: { code: string; change: () => void; remove: (() => void) | null }) {
  const name = keyName(code);
  return (
    <span data-key={code} className="inline-flex h-7 items-stretch rounded-sm border border-b-2 border-white/25 bg-white/8 text-[13px] font-semibold">
      <button type="button" aria-label={`Change ${name}`} onClick={change} className="min-w-7 cursor-pointer px-2 transition-colors hover:text-victory">
        {name}
      </button>
      {remove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={remove}
          className="cursor-pointer border-l border-white/15 px-1.5 font-normal text-white/40 transition-colors hover:text-white"
        >
          ×
        </button>
      )}
    </span>
  );
}

function PressAKey() {
  return (
    <span className="inline-flex h-7 animate-pulse items-center rounded-sm border border-victory px-2 text-[13px] text-victory motion-reduce:animate-none">
      Press a key…
    </span>
  );
}

function describe(result: BindResult, code: string, action: ActionRef): string {
  const key = keyName(code);
  const label = (a: ActionRef) => actionDef(a).label;
  if (!result.ok) return `${key} is the only key for ${label(result.onlyKeyOf)}. Give that one another key first.`;
  const { takenFrom, gave } = result;
  if (takenFrom && gave) return `Swapped: ${key} is now ${label(action)}, ${keyName(gave)} is now ${label(takenFrom)}.`;
  if (takenFrom) return `${key} is now ${label(action)} instead of ${label(takenFrom)}.`;
  return "";
}
