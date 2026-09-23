import { assetKey, BTC_ASSET_ID } from "./assets";
import type { Zone } from "../types";

/** BTC 전용 기본 기준선. 다른 자산에는 적용하지 않는다(가격대가 전혀 다르므로). */
export const DEFAULT_ZONES: Zone[] = [
  { id: "z1", min: 0, max: 60000, label: "하락 목표 구간", tone: "위험" },
  { id: "z2", min: 60000, max: 70000, label: "200일선 아래", tone: "경계" },
  { id: "z3", min: 70000, max: 75000, label: "리테스트 확인 구간", tone: "관망" },
  { id: "z4", min: 75000, max: 79000, label: "1차 저항~고점 사이", tone: "긍정" },
  { id: "z5", min: 79000, max: Infinity, label: "신고가 갱신 시도", tone: "과열주의" },
];

const STORAGE_KEY = "btc-app-zones-v1";

/** 자산마다 기준선 세트를 따로 갖는다. BTC는 기존 키를 그대로 써서 저장된 값이 유지된다. */
export function loadZones(assetId: string): Zone[] {
  // BTC 외 자산은 가격대가 완전히 달라 BTC 기본값을 쓰면 잘못된 구간이 보인다.
  // 사용자가 설정에서 직접 넣을 때까지 빈 상태로 둔다.
  const fallback = assetId === BTC_ASSET_ID ? DEFAULT_ZONES : [];
  try {
    const raw = localStorage.getItem(assetKey(STORAGE_KEY, assetId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Zone[];
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map((z) => ({
      ...z,
      max: z.max === null ? Infinity : z.max,
    }));
  } catch {
    return fallback;
  }
}

export function saveZones(assetId: string, zones: Zone[]): void {
  const serializable = zones.map((z) => ({
    ...z,
    max: Number.isFinite(z.max) ? z.max : null,
  }));
  localStorage.setItem(assetKey(STORAGE_KEY, assetId), JSON.stringify(serializable));
}

export function getZone(zones: Zone[], price: number): Zone | undefined {
  return zones
    .slice()
    .sort((a, b) => a.min - b.min)
    .find((z) => price >= z.min && price < z.max);
}
