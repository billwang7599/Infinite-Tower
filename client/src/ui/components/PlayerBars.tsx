import { Bar } from "./Bar.js";

interface PlayerBarsProps {
  hpFraction: number;
  staminaFraction: number;
}

export function PlayerBars({ hpFraction, staminaFraction }: PlayerBarsProps) {
  return (
    <div className="w-75">
      <Bar fraction={hpFraction} fill="from-hp to-hp-dark" chip />
      <Bar fraction={staminaFraction} fill="from-stamina to-stamina-dark" className="w-[70%]" />
    </div>
  );
}
