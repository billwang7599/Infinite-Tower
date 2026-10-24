import { useEffect, useState, type ReactNode } from "react";
import type { KeyBindings } from "../../settings/bindings.js";
import { PlayerBars } from "../components/PlayerBars.js";
import type { FieldHudState, SettingsScreenState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { CharacterPanel } from "./character/CharacterPanel.js";

type HudProps = { hud: Store<FieldHudState> };

interface FieldHudProps extends HudProps {
  bindings: KeyBindings;
  /** The bound Character key does nothing while Settings is open (it may be getting rebound). */
  settingsScreen: Store<SettingsScreenState>;
  openSettings: () => void;
}

export function FieldHud({ hud, bindings, settingsScreen, openSettings }: FieldHudProps) {
  const [characterOpen, setCharacterOpen] = useState(false);
  const stats = useStore(hud, (s) => s.stats);
  const characterKeys = useStore(bindings, (b) => b.field.character);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !characterKeys.includes(e.code) || settingsScreen.get().open) return;
      setCharacterOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [characterKeys, settingsScreen]);

  return (
    <div id="field-hud" className="pointer-events-none absolute inset-0 font-ui text-base/snug font-semibold text-white text-shadow-hud">
      <PlayerStatus hud={hud} />
      <div className="absolute top-3 right-4 flex items-center gap-3">
        <LevelName hud={hud} />
        <HudButton id="character-button" label="Character" onClick={() => setCharacterOpen((open) => !open)}>
          <PersonIcon />
        </HudButton>
        <HudButton id="settings-button" label="Settings" onClick={openSettings}>
          <GearIcon />
        </HudButton>
      </div>
      {characterOpen && <CharacterPanel stats={stats} close={() => setCharacterOpen(false)} />}
    </div>
  );
}

function PlayerStatus({ hud }: HudProps) {
  const hp = useStore(hud, (s) => s.hp);
  const stamina = useStore(hud, (s) => s.stamina);
  const wins = useStore(hud, (s) => s.wins);
  return (
    <div className="absolute top-3 left-4">
      <PlayerBars hp={hp} stamina={stamina} />
      <div id="field-wins" className="text-[13px] font-normal">
        Boars defeated: <span className="font-semibold text-victory">{wins}</span>
      </div>
    </div>
  );
}

function LevelName({ hud }: HudProps) {
  const name = useStore(hud, (s) => s.levelName);
  return <div id="field-level" className="font-title text-[17px] font-medium tracking-wide">{name}</div>;
}

function HudButton({ id, label, onClick, children }: { id: string; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      // Keyboard game: out of the tab order and never focused by a click, so Space / Enter can't press it.
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
    >
      {children}
    </button>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
