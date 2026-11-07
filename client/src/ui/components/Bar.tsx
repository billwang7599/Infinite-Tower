import { useState } from "react";

interface BarProps {
  /** How full, 0..1. */
  fraction: number;
  /** Gradient stops for the fill, written out in full (e.g. "from-hp to-hp-dark") so Tailwind finds them. */
  fill: string;
  /** Souls-style damage chip: a pale layer that lags behind after a hit. */
  chip?: boolean;
  className: string;
}

export function Bar({ fraction, fill, chip = false, className }: BarProps) {
  return (
    <div className={`bar ${className}`}>
      {chip && <DamageChip fraction={fraction} />}
      <div className={`bar-layer bg-linear-to-b ${fill}`} style={{ width: percent(fraction) }} />
    </div>
  );
}

const CHIP_HOLD_S = 0.6;
const CHIP_DRAIN_PER_S = 0.8;

/** Holds at the old value for a moment after damage, then drains at a steady rate. Healing snaps. */
function DamageChip({ fraction }: { fraction: number }) {
  const [last, setLast] = useState(fraction);
  const [transition, setTransition] = useState("none");
  if (fraction !== last) {
    setLast(fraction);
    const drainS = (last - fraction) / CHIP_DRAIN_PER_S;
    setTransition(fraction < last ? `width ${drainS.toFixed(2)}s linear ${CHIP_HOLD_S}s` : "none");
  }
  return <div className="bar-layer bg-chip" style={{ width: percent(fraction), transition }} />;
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
