import type { BoundaryProximity, Zone } from "../types";

// 설계 문서 3-1절: 기준선 근처(±2% 이내)에 가격이 도달하면 알림 대상으로 간주
export const PROXIMITY_THRESHOLD_PCT = 2;

/** Finds zone boundaries the current price is within PROXIMITY_THRESHOLD_PCT of. */
export function findNearbyBoundaries(zones: Zone[], price: number): BoundaryProximity[] {
  const results: BoundaryProximity[] = [];
  for (const z of zones) {
    if (z.min > 0) {
      const distancePct = (Math.abs(price - z.min) / z.min) * 100;
      if (distancePct <= PROXIMITY_THRESHOLD_PCT) {
        results.push({ key: `${z.id}:min`, zoneId: z.id, zoneLabel: z.label, boundaryPrice: z.min, boundaryType: "min", distancePct });
      }
    }
    if (Number.isFinite(z.max)) {
      const distancePct = (Math.abs(price - z.max) / z.max) * 100;
      if (distancePct <= PROXIMITY_THRESHOLD_PCT) {
        results.push({ key: `${z.id}:max`, zoneId: z.id, zoneLabel: z.label, boundaryPrice: z.max, boundaryType: "max", distancePct });
      }
    }
  }
  return results.sort((a, b) => a.distancePct - b.distancePct);
}
