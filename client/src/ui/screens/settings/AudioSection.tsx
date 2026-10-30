import { VOLUME, VOLUMES, type AudioSettings, type VolumeName } from "../../../settings/audio.js";
import { BUTTON } from "../../components/styles.js";
import { useStore } from "../../useStore.js";
import { FOCUS_RING, SECTION_TITLE, SETTING_LABEL, SETTING_ROW } from "./styles.js";

const LABELS: Record<VolumeName, { label: string; hint: string }> = {
  master: { label: "Master volume", hint: "Every sound" },
  effects: { label: "Effects", hint: "Fighting, footsteps, items and clicks" },
  ambient: { label: "Ambient", hint: "Water and campfires" },
};

export function AudioSection({ audio }: { audio: AudioSettings }) {
  return (
    <section id="audio-settings" className="mt-6">
      <h3 className={SECTION_TITLE}>Sound</h3>
      <div className="mt-2">
        {VOLUMES.map((name) => <VolumeRow key={name} audio={audio} name={name} />)}
      </div>
    </section>
  );
}

function VolumeRow({ audio, name }: { audio: AudioSettings; name: VolumeName }) {
  const volume = useStore(audio, (s) => s[name]);
  const id = `volume-${name}`;
  return (
    <div className={SETTING_ROW}>
      <label htmlFor={id} className="flex flex-col">
        <span className={SETTING_LABEL}>{LABELS[name].label}</span>
        <span className="text-xs text-white/45">{LABELS[name].hint}</span>
      </label>
      <span className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={VOLUME.step}
          value={volume}
          onChange={(e) => audio.setVolume(name, e.currentTarget.valueAsNumber)}
          className={`w-44 cursor-pointer accent-victory ${FOCUS_RING}`}
        />
        <output htmlFor={id} className="w-11 text-right text-[13px] font-semibold tabular-nums">
          {Math.round(volume * 100)}%
        </output>
        <button
          type="button" disabled={audio.isDefault(name)} onClick={() => audio.setVolume(name, VOLUME.defaults[name])}
          className={BUTTON.plain}
        >
          Reset
        </button>
      </span>
    </div>
  );
}
