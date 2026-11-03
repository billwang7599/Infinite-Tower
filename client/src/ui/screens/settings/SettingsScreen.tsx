/**
 * The settings, over the game. Esc or the overworld HUD's button opens them; Esc, ✕ or Resume closes them. The game
 * keeps running underneath (a fight doesn't pause) but gets no input meanwhile.
 */
import { useState } from "react";
import type { HudSettings } from "../../../settings/hud.js";
import { Modal } from "../../components/Modal.js";
import { BUTTON } from "../../components/styles.js";
import { useAction } from "../../components/useAction.js";
import { useGame } from "../../context.js";
import { useStore } from "../../useStore.js";
import { AudioSection } from "./AudioSection.js";
import { CameraSection } from "./CameraSection.js";
import { KeyBindingsList } from "./KeyBindingsList.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

export function SettingsScreen() {
  const { ui, settings, input, actions: { returnToTitle } } = useGame();
  const { settingsScreen: screen, openSettings: open, closeSettings: close } = ui;
  const isOpen = useStore(screen, (s) => s.open);

  useAction(input, ["menu"], (_action, repeat) => {
    if (repeat) return false;
    if (isOpen) close();
    else open();
  });

  if (!isOpen) return null;
  return (
    <Modal id="settings" title="Settings" width="w-[min(600px,92vw)]" close={close}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7">
        <CameraSection camera={settings.camera} mouse={settings.mouse} />
        <HudSection hud={settings.hud} />
        <AudioSection audio={settings.audio} />
        <KeyBindingsList bindings={settings.bindings} input={input} />
      </div>
      <Footer close={close} returnToTitle={returnToTitle} />
    </Modal>
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
