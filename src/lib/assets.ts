import { loadObject, makeId, saveObject } from "./entryStore";
import type { Asset } from "../types";

const ASSETS_KEY = "btc-app-assets-v1";
const ACTIVE_ASSET_KEY = "btc-app-active-asset-v1";

/** The BTC asset keeps this fixed id so pre-multi-asset saved data stays attached to it. */
export const BTC_ASSET_ID = "btc";

export const DEFAULT_ASSETS: Asset[] = [
  { id: BTC_ASSET_ID, name: "비트코인", currency: "$", source: { kind: "binance", symbol: "BTCUSDT" } },
];

/**
 * 라방이 실제로 운용하는 자산들. "추가" 버튼에서 한 번에 넣을 수 있게 미리 정의해둔다.
 * 분할매수 계획 수치는 2026-08-21/22 시황 기준 예시값이며, 앱에서 수정 가능하다.
 *
 * SPY/QQQ/SOXX/EWY/EWJ는 전부 미국 거래소 상장 티커라 Finnhub 무료 티어로 자동 조회된다
 * (사용자가 설정에서 본인 키를 넣어야 동작 — lib/finnhub.ts 참고). XAU(금)·COPPER(구리)는
 * 원자재라 무료 티어 지원 여부가 불확실해 보류했고, 국내 주식(하이닉스)은 Finnhub 무료 티어가
 * 한국거래소를 지원하지 않는 것을 stock-api-check.html로 실제 확인해 수동 입력으로 남겨뒀다.
 */
export const PRESET_ASSETS: Asset[] = [
  {
    id: "spy2x",
    name: "SPY 2X",
    currency: "$",
    source: { kind: "finnhub", symbol: "SPY" },
    ladder: { startPrice: 720, endPrice: 660, stepPrice: 10, pctPerStep: 3, currentPct: 4, totalPct: 25 },
  },
  {
    id: "qqq",
    name: "QQQ",
    currency: "$",
    source: { kind: "finnhub", symbol: "QQQ" },
    ladder: { startPrice: 680, endPrice: 590, stepPrice: 10, pctPerStep: 1, currentPct: 2, totalPct: 10 },
  },
  {
    id: "soxl",
    name: "SOXL (가격은 SOXX 기준)",
    currency: "$",
    source: { kind: "finnhub", symbol: "SOXX" },
    ladder: { startPrice: 490, endPrice: 400, stepPrice: 10, pctPerStep: 0.5, currentPct: 1.5, totalPct: 5 },
  },
  {
    id: "ewy",
    name: "EWY",
    currency: "$",
    source: { kind: "finnhub", symbol: "EWY" },
    ladder: { startPrice: 165, endPrice: 135, stepPrice: 5, pctPerStep: 1, currentPct: 5, totalPct: 7 },
  },
  {
    id: "ewj",
    name: "EWJ",
    currency: "$",
    source: { kind: "finnhub", symbol: "EWJ" },
    ladder: { startPrice: 90, endPrice: 86, stepPrice: 2, pctPerStep: 1, currentPct: 1, totalPct: 3 },
  },
  { id: "xau", name: "XAU (금)", currency: "$", source: { kind: "manual" } },
  { id: "copper", name: "COPPER (구리)", currency: "$", source: { kind: "manual" } },
  { id: "hynix", name: "SK하이닉스", currency: "₩", source: { kind: "manual" } },
];

export function loadAssets(): Asset[] {
  const stored = loadObject<Asset[] | null>(ASSETS_KEY, null);
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_ASSETS;
  // BTC must always exist — every BTC-only panel (A지표, 실수요, 매매장부) hangs off it.
  return stored.some((a) => a.id === BTC_ASSET_ID) ? stored : [...DEFAULT_ASSETS, ...stored];
}

export function saveAssets(assets: Asset[]): void {
  saveObject(ASSETS_KEY, assets);
}

export function loadActiveAssetId(): string {
  return loadObject<string>(ACTIVE_ASSET_KEY, BTC_ASSET_ID);
}

export function saveActiveAssetId(id: string): void {
  saveObject(ACTIVE_ASSET_KEY, id);
}

export function newCustomAsset(name: string, currency: string): Asset {
  return { id: makeId(), name, currency, source: { kind: "manual" } };
}

/**
 * Per-asset storage key. BTC keeps the original unsuffixed keys so data saved
 * before multi-asset support still loads.
 */
export function assetKey(baseKey: string, assetId: string): string {
  return assetId === BTC_ASSET_ID ? baseKey : `${baseKey}:${assetId}`;
}
