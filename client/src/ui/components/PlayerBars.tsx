import { coreName, type CoreState } from "@infinite-tower/shared";
import { Bar } from "./Bar.js";

interface PlayerBarsProps {
  hpFraction: number;
  staminaFraction: number;
  core: CoreState | null;
}

export function PlayerBars({ hpFraction, staminaFraction, core }: PlayerBarsProps) {
  return (
    <div className="w-75">
      <Bar fraction={hpFraction} fill="from-hp to-hp-dark" chip />
      <Bar fraction={staminaFraction} fill="from-stamina to-stamina-dark" className="w-[70%]" />
      {core && (
        <div id="core-name" className="text-[13px] font-semibold tracking-wide text-victory">{coreName(core)}</div>
      )}
    </div>
  );
}
