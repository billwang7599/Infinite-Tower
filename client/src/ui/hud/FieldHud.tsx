import type { FieldHudState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";

export function FieldHud({ hud, openSettings }: { hud: Store<FieldHudState>; openSettings: () => void }) {
  const levelName = useStore(hud, (s) => s.levelName);
  const wins = useStore(hud, (s) => s.wins);
  return (
    <div id="field-hud" className="pointer-events-none fixed inset-x-4 top-3 flex items-start justify-between font-ui text-base/snug font-semibold text-white text-shadow-hud">
      <span>{levelName} &nbsp;·&nbsp; boars defeated: {wins}</span>
      <button
        type="button"
        id="settings-button"
        aria-label="Settings"
        // Keyboard game: out of the tab order and never focused by a click, so Space / Enter can't press it.
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={openSettings}
        className="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white/80 transition-colors hover:bg-black/60 hover:text-white"
      >
        <GearIcon />
      </button>
    </div>
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
