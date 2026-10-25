/** The camera settings: a sensitivity slider (drag it, or focus it and use the arrow keys). */
import { SENSITIVITY, type CameraSettings } from "../../../settings/camera.js";
import { BUTTON } from "../../components/styles.js";
import { useStore } from "../../useStore.js";
import { SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

export function CameraSection({ camera }: { camera: CameraSettings }) {
  const sensitivity = useStore(camera, (s) => s.sensitivity);
  return (
    <section id="camera-settings" className="pt-2">
      <h3 className={SECTION_TITLE}>Camera</h3>
      <div className={`mt-2 ${SETTING_ROW}`}>
        <label htmlFor="camera-sensitivity" className="flex flex-col">
          <span className={SETTING_LABEL}>Sensitivity</span>
          <span className="text-xs text-white/45">Mouse, trackpad and the turn keys</span>
        </label>
        <span className="flex items-center gap-3">
          <input
            id="camera-sensitivity"
            type="range"
            min={SENSITIVITY.min}
            max={SENSITIVITY.max}
            step={SENSITIVITY.step}
            value={sensitivity}
            onChange={(e) => camera.setSensitivity(e.currentTarget.valueAsNumber)}
            className={
              "w-44 cursor-pointer accent-victory focus-visible:outline-2 focus-visible:outline-offset-4 "
              + "focus-visible:outline-victory"
            }
          />
          <output htmlFor="camera-sensitivity" className="w-11 text-right text-[13px] font-semibold tabular-nums">
            {Math.round(sensitivity * 100)}%
          </output>
          <button type="button" disabled={camera.isDefault()} onClick={() => camera.reset()} className={BUTTON.plain}>
            Reset
          </button>
        </span>
      </div>
    </section>
  );
}
