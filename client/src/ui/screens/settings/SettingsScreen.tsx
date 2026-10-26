/**
 * The settings, over the game. Esc or the field HUD's button opens them; Esc, ✕ or Resume closes them. The
 * game keeps running underneath (as in a souls game, a fight doesn't pause) but gets no input meanwhile.
 */
import { useState } from "react";
import type { Settings } from "../../../settings/settings.js";
import { Dialog } from "../../components/Dialog.js";
import { BUTTON, DIALOG_BOX, DIALOG_TITLE } from "../../components/styles.js";
import { useKeydown } from "../../components/useKeydown.js";
import type { SettingsScreenState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { CameraSection } from "./CameraSection.js";
import { KeyBindingsList } from "./KeyBindingsList.js";

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
    if (e.code !== "Escape" || e.repeat) return;
    e.preventDefault();
    if (isOpen) close();
    else open();
  });

  if (!isOpen) return null;
  return (
    <Dialog id="settings" titleId="settings-title" dim="bg-black/55">
      <section className={`flex max-h-[min(760px,92vh)] w-[min(600px,92vw)] flex-col ${DIALOG_BOX}`}>
        <header className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id="settings-title" className={DIALOG_TITLE}>Settings</h2>
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
          <KeyBindingsList bindings={settings.bindings} />
        </div>
        <Footer close={close} returnToTitle={returnToTitle} />
      </section>
    </Dialog>
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
