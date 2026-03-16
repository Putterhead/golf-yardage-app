// ── Geodesic helpers ─────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371000; // Earth radius in meters

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in meters between two lat/lng points */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Convert meters to yards */
export function metersToYards(m: number): number {
  return m * 1.09361;
}

/** Convert meters to the user's distance unit */
export function metersToUnit(m: number, unit: "yards" | "meters"): number {
  return unit === "yards" ? metersToYards(m) : m;
}

/**
 * Signed perpendicular offset (dispersion) in meters from the tee→target line.
 * Positive = right of the line, Negative = left.
 * Uses cross-track distance on a flat projection (accurate enough for < 500m).
 */
export function dispersionMeters(
  tee: LatLng,
  target: LatLng,
  landing: LatLng
): number {
  // Convert to local ENU meters (flat-earth approx centered on tee)
  const cosLat = Math.cos(toRad(tee.lat));
  const tx = (target.lng - tee.lng) * toRad(1) * R * cosLat;
  const ty = (target.lat - tee.lat) * toRad(1) * R;
  const lx = (landing.lng - tee.lng) * toRad(1) * R * cosLat;
  const ly = (landing.lat - tee.lat) * toRad(1) * R;

  // Length of tee→target vector
  const len = Math.sqrt(tx * tx + ty * ty);
  if (len === 0) return 0;

  // Cross product gives signed perpendicular distance
  return (tx * ly - ty * lx) / len;
}

/**
 * Adjusted carry: accounts for elevation.
 * Formula: raw * (1 + (elevation_feet / 1000) * 0.0012)
 * elevation should be in the same unit system as distance — we convert to feet internally.
 */
export function adjustedCarry(
  rawMeters: number,
  elevationValue: number,
  distanceUnit: "yards" | "meters"
): number {
  // Convert elevation to feet
  const elevFeet =
    distanceUnit === "yards"
      ? elevationValue * 3 // elevation entered in yards → feet
      : elevationValue * 3.28084; // elevation entered in meters → feet
  const factor = 1 + (elevFeet / 1000) * 0.0012;
  return rawMeters * factor;
}

/** Bearing from A to B in degrees (0 = north, clockwise) */
export function bearing(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
