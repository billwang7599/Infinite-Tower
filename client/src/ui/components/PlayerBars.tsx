import { Bar } from "./Bar.js";

interface PlayerBarsProps {
  hpFraction: number;
  staminaFraction: number;
  hp?: number;
  hpMax?: number;
}

export function PlayerBars({ hpFraction, staminaFraction, hp, hpMax }: PlayerBarsProps) {
  return (
    <div className="relative w-75">
      <Bar fraction={hpFraction} fill="from-hp to-hp-dark" chip className="h-2" />
      <Bar fraction={staminaFraction} fill="from-stamina to-stamina-dark" className="h-1 [--point:3px]" />
      {hpMax !== undefined && hpMax > 0 && (
        <span
          id="hp-numbers"
          className={
            "absolute -top-1 left-full ml-2 text-[13px]/4 font-semibold tracking-[0.08em] whitespace-nowrap "
            + "tabular-nums"
          }
        >
          {hp} <span className="text-bone/70">/ {hpMax}</span>
        </span>
      )}
    </div>
  );
}
