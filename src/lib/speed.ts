export const SPEED_MIN = 0.25
export const SPEED_MAX = 1.25

/** 0.5 → "0.5×", 1 → "1×" */
export const formatSpeed = (s: number) => `${Math.round(s * 100) / 100}×`
