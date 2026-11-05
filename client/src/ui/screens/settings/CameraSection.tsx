import { SENSITIVITY, type CameraSettings } from "../../../settings/camera.js";
import { FLICK_SENSITIVITY, type MouseSettings } from "../../../settings/mouse.js";
import { BUTTON } from "../../components/styles.js";
import { useStore } from "../../useStore.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

export function CameraSection({ camera, mouse }: { camera: CameraSettings; mouse: MouseSettings }) {
  const sensitivity = useStore(camera, (s) => s.sensitivity);
  return (
    <section id="camera-settings" className="pt-2">
      <h3 className={SECTION_TITLE}>Camera and mouse</h3>
      <div className={`mt-2 ${SETTING_ROW}`}>
        <label htmlFor="camera-sensitivity" className="flex flex-col">
          <span className={SETTING_LABEL}>Sensitivity</span>
          <span className="text-xs text-white/45">Middle-button drag and the arrow keys, unlocked</span>
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
            className={`w-44 cursor-pointer accent-victory ${FOCUS_RING}`}
          />
          <output htmlFor="camera-sensitivity" className="w-11 text-right text-[13px] font-semibold tabular-nums">
            {Math.round(sensitivity * 100)}%
          </output>
          <button
            type="button" disabled={camera.sensitivityIsDefault()} onClick={() => camera.reset()} className={BUTTON.plain}
          >
            Reset
          </button>
        </span>
      </div>
      <FlickSensitivityRow mouse={mouse} />
      <AutoLockRow mouse={mouse} />
    </section>
  );
}

function FlickSensitivityRow({ mouse }: { mouse: MouseSettings }) {
  const sensitivity = useStore(mouse, (s) => s.flickSensitivity);
  return (
    <div className={SETTING_ROW}>
      <label htmlFor="flick-sensitivity" className="flex flex-col">
        <span className={SETTING_LABEL}>Flick sensitivity</span>
        <span className="text-xs text-white/45">Higher: a shorter flick of the mouse aims</span>
      </label>
      <span className="flex items-center gap-3">
        <input
          id="flick-sensitivity"
          type="range"
          min={FLICK_SENSITIVITY.min}
          max={FLICK_SENSITIVITY.max}
          step={FLICK_SENSITIVITY.step}
          value={sensitivity}
          onChange={(e) => mouse.setFlickSensitivity(e.currentTarget.valueAsNumber)}
          className={`w-44 cursor-pointer accent-victory ${FOCUS_RING}`}
        />
        <output htmlFor="flick-sensitivity" className="w-11 text-right text-[13px] font-semibold tabular-nums">
          {Math.round(sensitivity * 100)}%
        </output>
        <button
          type="button" disabled={sensitivity === FLICK_SENSITIVITY.default}
          onClick={() => mouse.setFlickSensitivity(FLICK_SENSITIVITY.default)} className={BUTTON.plain}
        >
          Reset
        </button>
      </span>
    </div>
  );
}

function AutoLockRow({ mouse }: { mouse: MouseSettings }) {
  const autoLock = useStore(mouse, (s) => s.autoLock);
  return (
    <div className={SETTING_ROW}>
      <label htmlFor="mouse-auto-lock" className="flex flex-col">
        <span className={SETTING_LABEL}>Auto mouse lock</span>
        <span className="text-xs text-white/45">
          Capture the mouse as a fight starts or a menu over it closes, without a click
        </span>
      </label>
      <input
        id="mouse-auto-lock"
        type="checkbox"
        checked={autoLock}
        onChange={(e) => mouse.setAutoLock(e.currentTarget.checked)}
        className={`size-4 cursor-pointer accent-victory ${FOCUS_RING}`}
      />
    </div>
  );
}
