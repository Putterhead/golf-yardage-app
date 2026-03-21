/**
 * Statistical helper functions for golf shot analysis.
 * Pure JS — no external math libraries needed.
 */

/** Sort numbers ascending (non-mutating) */
function sorted(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/** Arithmetic mean */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Percentile using linear interpolation (exclusive method).
 * p is 0–100.
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = sorted(arr);
  if (s.length === 1) return s[0];
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/** Median (50th percentile) */
export function median(arr: number[]): number {
  return percentile(arr, 50);
}

/** Interquartile range (75th − 25th percentile) */
export function iqr(arr: number[]): number {
  return percentile(arr, 75) - percentile(arr, 25);
}

/** Population standard deviation */
export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Containment radius: the smallest distance from mean that
 * contains at least `pct`% of shots (0–100).
 */
export function containmentRadius(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const dists = sorted(values.map((v) => Math.abs(v - m)));
  const idx = Math.min(
    Math.ceil((pct / 100) * dists.length) - 1,
    dists.length - 1
  );
  return dists[Math.max(idx, 0)];
}

/**
 * Lateral spread: left-right range excluding top/bottom trimPct%.
 * Returns [low, high] percentile values.
 */
export function lateralSpread(
  arr: number[],
  trimPct: number = 5
): { low: number; high: number; spread: number } {
  const low = percentile(arr, trimPct);
  const high = percentile(arr, 100 - trimPct);
  return { low, high, spread: high - low };
}

/** Round to n decimal places */
export function round(value: number, decimals: number = 1): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
