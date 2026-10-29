/** Day fractions: 0 midnight, 0.5 noon. */
export const DAY_TIMES = [
  { label: "Dawn", fraction: 0.2 }, { label: "Noon", fraction: 0.5 }, { label: "Dusk", fraction: 0.8 },
  { label: "Midnight", fraction: 0 },
] as const;

/** Days per real day. */
export const DAY_SPEEDS = [1, 10, 60, 600] as const;

export const GIVE_COUNTS = [1, 5, 20] as const;
