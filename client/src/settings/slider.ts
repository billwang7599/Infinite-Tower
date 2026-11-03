import { clamp, roundTo } from "@infinite-tower/shared";

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

// Snapped to the step, so 1.1 doesn't come out as 1.1000000000000003.
export const snapToSlider = ({ min, max, step }: SliderRange, value: number): number =>
  clamp(roundTo(Math.round(value / step) * step, 2), min, max);

export const savedOnSlider = ({ min, max }: SliderRange, saved: unknown, fallback: number): number =>
  typeof saved === "number" && saved >= min && saved <= max ? saved : fallback;
