import { rsi, sma } from "./indicators";
import type { Candle } from "../types";

// 이평선 계열(추세)과 달리 "지금 싼가/비싼가"를 재는 지표들. 전부 이미 받아오는
// Binance 일봉·주봉만으로 계산한다 — 새 데이터 소스 없음.

export const MA_200W_PERIOD = 200;
// 파이 사이클 탑: 111일선이 350일선×2를 위로 넘으면 과거 사이클 고점 부근이었다.
export const PI_CYCLE_SHORT_PERIOD = 111;
export const PI_CYCLE_LONG_PERIOD = 350;

export interface ValuationMetrics {
  /** 200주 이평선 — 주봉 200개가 안 되면 null. */
  ma200w: number | null;
  /** 주봉 RSI(14). */
  weeklyRsi: number | null;
  /** 받아온 데이터(주봉 전체 + 일봉 + 현재가) 안에서의 최고가. */
  ath: number | null;
  /** 최고가를 찍은 날 (YYYY-MM-DD). 일봉 범위 밖이면 그 주의 시작일. */
  athDate: string | null;
  piShort: number | null;
  /** 350일선 × 2. */
  piLongX2: number | null;
}

const EMPTY: ValuationMetrics = {
  ma200w: null,
  weeklyRsi: null,
  ath: null,
  athDate: null,
  piShort: null,
  piLongX2: null,
};

function last<T>(arr: T[]): T | null {
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function maxHigh(candles: Candle[]): Candle | null {
  let best: Candle | null = null;
  for (const c of candles) {
    if (best === null || c.high > best.high) best = c;
  }
  return best;
}

export function computeValuationMetrics(
  daily: Candle[],
  weekly: Candle[],
  price: number | null,
  today: Date = new Date(),
): ValuationMetrics {
  if (daily.length === 0 && weekly.length === 0) return EMPTY;

  const weeklyClose = weekly.map((c) => c.close);
  const dailyClose = daily.map((c) => c.close);

  // 일봉이 날짜가 정확하므로 같은 값이면 일봉 쪽 날짜를 쓴다. 주봉은 일봉 1000일보다
  // 오래된 고점을 놓치지 않기 위한 것.
  const dailyTop = maxHigh(daily);
  const weeklyTop = maxHigh(weekly);
  let ath: number | null = null;
  let athDate: string | null = null;
  if (dailyTop && (!weeklyTop || dailyTop.high >= weeklyTop.high)) {
    ath = dailyTop.high;
    athDate = dailyTop.date.slice(0, 10);
  } else if (weeklyTop) {
    ath = weeklyTop.high;
    athDate = weeklyTop.date.slice(0, 10);
  }
  // 캔들 캐시(5분)보다 현재가가 먼저 신고가를 찍는 경우.
  if (price != null && (ath === null || price > ath)) {
    ath = price;
    athDate = today.toISOString().slice(0, 10);
  }

  const piLong = last(sma(dailyClose, PI_CYCLE_LONG_PERIOD));

  return {
    ma200w: last(sma(weeklyClose, MA_200W_PERIOD)),
    weeklyRsi: last(rsi(weeklyClose)),
    ath,
    athDate,
    piShort: last(sma(dailyClose, PI_CYCLE_SHORT_PERIOD)),
    piLongX2: piLong != null ? piLong * 2 : null,
  };
}
