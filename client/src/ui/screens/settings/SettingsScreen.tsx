/**
 * The settings, over the game. Esc or the field HUD's button opens them; Esc, ✕ or Resume closes them. The
 * game keeps running underneath (as in a souls game, a fight doesn't pause) but gets no input meanwhile.
 */
import { useEffect } from "react";
import type { KeyBindings } from "../../../settings/bindings.js";
import type { SettingsState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { BUTTON } from "./buttons.js";
import { KeyBindingsList } from "./KeyBindingsList.js";

interface SettingsProps {
  settings: Store<SettingsState>;
  open: () => void;
  close: () => void;
  bindings: KeyBindings;
}

export function SettingsScreen({ settings, open, close, bindings }: SettingsProps) {
  const isOpen = useStore(settings, (s) => s.open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape" || e.repeat) return;
      e.preventDefault();
      if (isOpen) close();
      else open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, open, close]);

  if (!isOpen) return null;
  return (
    <div
      id="settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 flex items-center justify-center bg-black/55 font-ui text-white select-none"
    >
      <section className="flex max-h-[min(760px,92vh)] w-[min(600px,92vw)] flex-col rounded-sm border border-white/15 bg-night/95 shadow-[0_20px_60px_#000c]">
        <header className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id="settings-title" className="font-title text-3xl tracking-[0.08em] text-victory">Settings</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </header>
        <KeyBindingsList bindings={bindings} />
        <footer className="flex justify-end border-t border-white/10 px-7 py-4">
          <button type="button" autoFocus onClick={close} className={BUTTON.primary}>
            Resume
          </button>
        </footer>
      </section>
    </div>
  );
}
