/**
 * The settings, over the game. Esc or the overworld HUD's button opens them; Esc, ✕ or Resume closes them. The game
 * keeps running underneath (a fight doesn't pause) but gets no input meanwhile.
 */
import { useState } from "react";
import { actionOf } from "../../../core/actions.js";
import type { HudSettings } from "../../../settings/hud.js";
import type { Settings } from "../../../settings/settings.js";
import { BUTTON } from "../../components/styles.js";
import { useKeydown } from "../../components/useKeydown.js";
import type { SettingsScreenState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { CameraSection } from "./CameraSection.js";
import { KeyBindingsList } from "./KeyBindingsList.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

interface SettingsProps {
  screen: Store<SettingsScreenState>;
  open: () => void;
  close: () => void;
  settings: Settings;
  returnToTitle: () => void;
}

export function SettingsScreen({ screen, open, close, settings, returnToTitle }: SettingsProps) {
  const isOpen = useStore(screen, (s) => s.open);

  useKeydown((e) => {
    if (actionOf(settings.bindings.get(), "general", e.code) !== "menu" || e.repeat) return;
    e.preventDefault();
    if (isOpen) close();
    else open();
  });

  if (!isOpen) return null;
  return (
    <div
      id="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title"
      className="fixed inset-0 flex items-center justify-center bg-black/55 font-ui text-white select-none"
    >
      <section
        className={
          "flex max-h-[min(760px,92vh)] w-[min(600px,92vw)] flex-col rounded-sm border border-white/15 bg-night/95 "
          + "shadow-[0_20px_60px_#000c]"
        }
      >
        <header className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id="settings-title" className="font-title text-3xl tracking-[0.08em] text-victory">Settings</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className={
              "flex size-8 cursor-pointer items-center justify-center rounded-full text-lg text-white/60 "
              + "transition-colors hover:bg-white/10 hover:text-white"
            }
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7">
          <CameraSection camera={settings.camera} mouse={settings.mouse} />
          <HudSection hud={settings.hud} />
          <KeyBindingsList bindings={settings.bindings} />
        </div>
        <Footer close={close} returnToTitle={returnToTitle} />
      </section>
    </div>
  );
}

function HudSection({ hud }: { hud: HudSettings }) {
  const showPing = useStore(hud, (s) => s.showPing);
  return (
    <section id="hud-settings" className="mt-6">
      <h3 className={SECTION_TITLE}>HUD</h3>
      <div className={`mt-2 ${SETTING_ROW}`}>
        <label htmlFor="show-ping" className="flex flex-col">
          <span className={SETTING_LABEL}>Show ping</span>
          <span className="text-xs text-white/45">The round trip to the server, in the top-right corner</span>
        </label>
        <input
          id="show-ping"
          type="checkbox"
          checked={showPing}
          onChange={(e) => hud.setShowPing(e.currentTarget.checked)}
          className={`size-4 cursor-pointer accent-victory ${FOCUS_RING}`}
        />
      </div>
    </section>
  );
}

/** Return to title asks once more, so a stray click doesn't end the session. */
function Footer({ close, returnToTitle }: { close: () => void; returnToTitle: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-7 py-4">
      {confirming ? (
        <>
          <span className="text-sm text-white/75">Are you sure?</span>
          <span className="flex gap-2">
            <button type="button" autoFocus onClick={() => setConfirming(false)} className={BUTTON.plain}>Stay</button>
            <button type="button" id="settings-leave" onClick={returnToTitle} className={BUTTON.danger}>
              Leave
            </button>
          </span>
        </>
      ) : (
        <>
          <button type="button" id="settings-return" onClick={() => setConfirming(true)} className={BUTTON.plain}>
            Return to title
          </button>
          <button type="button" autoFocus onClick={close} className={BUTTON.primary}>
            Resume
          </button>
        </>
      )}
    </footer>
  );
}
