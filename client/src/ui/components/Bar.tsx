import { useState } from "react";

interface BarProps {
  /** 0..1 */
  value: number;
  /** Gradient stops for the fill, written out in full (e.g. "from-hp to-hp-dark") so Tailwind finds them. */
  fill: string;
  /** Souls-style damage chip: a pale layer that lags behind after a hit. */
  chip?: boolean;
  className?: string;
}

export function Bar({ value, fill, chip = false, className = "" }: BarProps) {
  return (
    <div className={`bar ${className}`}>
      {chip && <DamageChip value={value} />}
      <div className={`bar-layer bg-linear-to-b ${fill}`} style={{ width: percent(value) }} />
    </div>
  );
}

const CHIP_HOLD_S = 0.6;
const CHIP_DRAIN_PER_S = 0.8;

/** Holds at the old value for a moment after damage, then drains at a steady rate. Healing snaps. */
function DamageChip({ value }: { value: number }) {
  const [last, setLast] = useState(value);
  const [transition, setTransition] = useState("none");
  if (value !== last) {
    setLast(value);
    setTransition(value < last ? `width ${((last - value) / CHIP_DRAIN_PER_S).toFixed(2)}s linear ${CHIP_HOLD_S}s` : "none");
  }
  return <div className="bar-layer bg-chip" style={{ width: percent(value), transition }} />;
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
