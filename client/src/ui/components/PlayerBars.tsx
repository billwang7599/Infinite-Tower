import { Bar } from "./Bar.js";

/** HP and stamina (fractions 0..1). Both HUDs draw them in the same corner, so they stay put across a mode switch. */
export function PlayerBars({ hp, stamina }: { hp: number; stamina: number }) {
  return (
    <div className="w-75">
      <Bar value={hp} fill="from-hp to-hp-dark" chip />
      <Bar value={stamina} fill="from-stamina to-stamina-dark" className="w-[70%]" />
    </div>
  );
}
