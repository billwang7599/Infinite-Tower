const WAYS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

type CompassLabel = (typeof WAYS)[number];

export const COMPASS = { widthPx: 240, heightPx: 24, pxPerDeg: 1 } as const;

const QUARTER_DEG = 90;
const STEP_DEG = 45;
const REACH_DEG = 225;

export interface CompassMark {
  label: CompassLabel;
  deg: number;
}

// Bearings aren't wrapped, so a mark keeps its place on the strip while it slides.
export function compassMarks(turns: number): CompassMark[] {
  const facingDeg = turns * QUARTER_DEG, marks: CompassMark[] = [];
  for (let deg = facingDeg - REACH_DEG; deg <= facingDeg + REACH_DEG; deg += STEP_DEG) {
    marks.push({ label: WAYS[(((deg / STEP_DEG) % WAYS.length) + WAYS.length) % WAYS.length]!, deg });
  }
  return marks;
}

export const stripShiftPx = (turns: number): number => -turns * QUARTER_DEG * COMPASS.pxPerDeg;
