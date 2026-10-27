/**
 * Every key binding, one row per action, in its group (general, overworld, battle). Click a key to change it (the next
 * key pressed takes its place; Esc cancels), + to add one, × to drop one. Mouse buttons and Esc are fixed and only
 * shown.
 */
import { MAX_KEYS_PER_ACTION } from "@infinite-tower/shared";
import { useState } from "react";
import {
  actionDef, actionsOf, GROUPS, isBindable, isFixed, keysOf, sameAction,
  type ActionRef, type BindResult, type Group, type KeyBindings, type KeyMap,
} from "../../../settings/bindings.js";
import { BUTTON } from "../../components/styles.js";
import { useKeydown } from "../../components/useKeydown.js";
import { keyName, mouseName } from "../../keyNames.js";
import { useStore } from "../../useStore.js";
import { SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

const GROUP_TITLES: Record<Group, string> = { general: "General", overworld: "Overworld", battle: "Battle" };

/** The slot waiting for a key: an action, and which of its keys the next one replaces (null: add one). */
interface Waiting {
  action: ActionRef;
  replacing: string | null;
}

export function KeyBindingsList({ bindings }: { bindings: KeyBindings }) {
  const keyMap = useStore(bindings, (s) => s);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [notice, setNotice] = useState("");

  // Capture phase, stopped there: the key is for this slot only (Esc must not also close the settings).
  useKeydown((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!waiting || e.repeat || (!isBindable(e.code) && e.code !== "Escape")) return;
    setWaiting(null);
    if (e.code === "Escape") return;
    const result = bindings.bind(waiting.action, e.code, waiting.replacing);
    setNotice(bindNotice(result, e.code, waiting.action));
  }, { enabled: waiting !== null, capture: true });

  const listenFor = (action: ActionRef, replacing: string | null) => {
    setNotice("");
    setWaiting({ action, replacing });
  };
  const reset = () => {
    bindings.reset();
    setWaiting(null);
    setNotice("Back to the default keys.");
  };

  return (
    <div id="key-bindings" className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className={SECTION_TITLE}>Key bindings</h3>
        <button type="button" disabled={bindings.isDefault()} onClick={reset} className={BUTTON.plain}>
          Reset to defaults
        </button>
      </div>
      {GROUPS.map((group) => (
        <GroupSection
          key={group} group={group} keyMap={keyMap} waiting={waiting} listenFor={listenFor}
          unbind={(action, key) => bindings.unbind(action, key)}
        />
      ))}
      <p aria-live="polite" className="sticky bottom-0 min-h-10 bg-night py-2.5 text-sm text-victory">{notice}</p>
    </div>
  );
}

interface GroupProps {
  group: Group;
  keyMap: KeyMap;
  waiting: Waiting | null;
  listenFor: (action: ActionRef, replacing: string | null) => void;
  unbind: (action: ActionRef, key: string) => void;
}

function GroupSection({ group, keyMap, waiting, listenFor, unbind }: GroupProps) {
  const actions = actionsOf(group);
  const hasMouse = actions.some((a) => actionDef(a).mouse);
  return (
    <section className="mt-4">
      <h4 className="mb-1 text-xs tracking-[0.3em] text-white/45 uppercase">{GROUP_TITLES[group]}</h4>
      {actions.map((action) => (
        <BindingRow
          key={action.action}
          action={action}
          mouseColumn={hasMouse}
          keys={keysOf(keyMap, action)}
          waitingFor={waiting && sameAction(waiting.action, action) ? waiting.replacing : undefined}
          listenFor={(replacing) => listenFor(action, replacing)}
          unbind={(key) => unbind(action, key)}
        />
      ))}
    </section>
  );
}

interface RowProps {
  action: ActionRef;
  /** Some action in this group has mouse buttons: every row keeps the column, so the keys line up. */
  mouseColumn: boolean;
  keys: readonly string[];
  /** undefined: not waiting here. A key: waiting to replace it. null: waiting to add one. */
  waitingFor: string | null | undefined;
  listenFor: (replacing: string | null) => void;
  unbind: (key: string) => void;
}

function BindingRow({ action, mouseColumn, keys, waitingFor, listenFor, unbind }: RowProps) {
  const def = actionDef(action);
  const fixed = isFixed(action);
  return (
    <div data-action={`${action.group}.${action.action}`} className={SETTING_ROW}>
      <span className={SETTING_LABEL}>{def.label}</span>
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        {keys.map((key) =>
          waitingFor === key ? (
            <PressAKey key={key} />
          ) : (
            <KeyChip
              key={key} code={key} change={fixed ? null : () => listenFor(key)}
              remove={!fixed && keys.length > 1 ? () => unbind(key) : null}
            />
          ),
        )}
        {waitingFor === null ? (
          <PressAKey />
        ) : (
          !fixed && keys.length < MAX_KEYS_PER_ACTION && (
            <button
              type="button"
              aria-label={`Add a key for ${def.label}`}
              onClick={() => listenFor(null)}
              className={
                "h-7 w-7 cursor-pointer rounded-sm border border-dashed border-white/25 text-white/45 "
                + "transition-colors hover:border-white/60 hover:text-white"
              }
            >
              +
            </button>
          )
        )}
        {mouseColumn && (
          <span className="ml-1 w-22 text-right text-xs text-white/45">{def.mouse?.map(mouseName).join(" / ")}</span>
        )}
      </span>
    </div>
  );
}

interface ChipProps {
  code: string;
  /** null: fixed, only shown. */
  change: (() => void) | null;
  remove: (() => void) | null;
}

function KeyChip({ code, change, remove }: ChipProps) {
  const name = keyName(code);
  return (
    <span
      data-key={code}
      className={
        "inline-flex h-7 items-stretch rounded-sm border border-b-2 border-white/25 bg-white/8 text-[13px] "
        + "font-semibold"
      }
    >
      {change ? (
        <button
          type="button" aria-label={`Change ${name}`} onClick={change}
          className="min-w-7 cursor-pointer px-2 transition-colors hover:text-victory"
        >
          {name}
        </button>
      ) : (
        <span className="flex min-w-7 items-center justify-center px-2 text-white/60">{name}</span>
      )}
      {remove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={remove}
          className={
            "cursor-pointer border-l border-white/15 px-1.5 font-normal text-white/40 transition-colors "
            + "hover:text-white"
          }
        >
          ×
        </button>
      )}
    </span>
  );
}

function PressAKey() {
  return (
    <span
      className={
        "inline-flex h-7 animate-pulse items-center rounded-sm border border-victory px-2 text-[13px] text-victory "
        + "motion-reduce:animate-none"
      }
    >
      Press a key…
    </span>
  );
}

/** What to tell the player after a bind: a refusal, or which action lost (or swapped) the key. */
function bindNotice(result: BindResult, code: string, action: ActionRef): string {
  const key = keyName(code);
  const label = (a: ActionRef) => actionDef(a).label;
  if (!result.ok && "full" in result) return `${label(action)} has no room for another key. Replace one of its keys.`;
  if (!result.ok) return `${key} is the only key for ${label(result.onlyKeyOf)}. Give that one another key first.`;
  const { gave } = result;
  const takenFrom = result.takenFrom.map(label).join(" and ");
  if (takenFrom && gave) return `Swapped: ${key} is now ${label(action)}, ${keyName(gave)} is now ${takenFrom}.`;
  if (takenFrom) return `${key} is now ${label(action)} instead of ${takenFrom}.`;
  return "";
}
