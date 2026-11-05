import { Bar } from "./Bar.js";

interface PlayerBarsProps {
  hpFraction: number;
  staminaFraction: number;
  hp?: number;
  hpMax?: number;
}

export function PlayerBars({ hpFraction, staminaFraction, hp, hpMax }: PlayerBarsProps) {
  return (
    <div className="w-75">
      <div className="relative">
        <Bar fraction={hpFraction} fill="from-hp to-hp-dark" chip className="h-3.5" />
        {hpMax !== undefined && hpMax > 0 && (
          <span
            id="hp-numbers"
            className="absolute inset-y-0 right-1.5 text-[10px]/3.5 font-semibold tabular-nums text-white/90"
          >
            {hp} / {hpMax}
          </span>
        )}
      </div>
      <Bar fraction={staminaFraction} fill="from-stamina to-stamina-dark" className="h-2" />
    </div>
  );
}
