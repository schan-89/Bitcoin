import type { Candle, CrossEvent, IndicatorSeries } from "../types";

// 라방이 쓰는 기간들을 일봉 기준으로 환산한 값.
// 50주 = 350일, Bull Market Support Band = 20주 SMA(140일) + 21주 EMA(147일).
export const MA_50W_PERIOD = 350;
export const BMSB_SMA_PERIOD = 140;
export const BMSB_EMA_PERIOD = 147;
export const RSI_PERIOD = 14;

// 주봉 데이터는 봉 자체가 이미 "1주"이므로 일봉처럼 ×7 환산할 필요가 없다 —
// 불마켓밴드는 원래 정의 그대로 20주/21주 봉을 바로 쓰는 게 표준이라, 오히려
// 일봉 기반(140/147일) 근사보다 이쪽이 더 정확하다.
export const WEEKLY_MA_SHORT_PERIOD = 50; // 50주선
export const WEEKLY_MA_LONG_PERIOD = 200; // 200주선 — 비트코인 장기 사이클을 볼 때 자주 쓰는 그 지표
export const WEEKLY_BMSB_SMA_PERIOD = 20;
export const WEEKLY_BMSB_EMA_PERIOD = 21;

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * EMA seeded with the first `period` values' SMA, and left null before that —
 * seeding from a single price makes the early curve meaningless, and the band
 * built from it would start in the wrong place.
 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = RSI_PERIOD): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function buildIndicatorSeries(candles: Candle[]): IndicatorSeries {
  const close = candles.map((c) => c.close);
  return {
    dates: candles.map((c) => c.date),
    candles,
    close,
    ma50: sma(close, 50),
    ma200: sma(close, 200),
    ma50w: sma(close, MA_50W_PERIOD),
    bmsbSma: sma(close, BMSB_SMA_PERIOD),
    bmsbEma: ema(close, BMSB_EMA_PERIOD),
    rsi14: rsi(close),
  };
}

/**
 * buildIndicatorSeries와 같은 필드 구조를 다른 봉 단위에 맞는 기간 상수로 채운다.
 * ma50w는 일봉 전용 세 번째 이평선이라 다른 봉에선 항상 비워둔다. bmsbSma/bmsbEma도
 * 기간을 안 주면 비워지는데, CandleChart의 밴드 그리기 코드가 null 값을 만나면
 * 그 지점을 건너뛰므로(불마켓밴드 없음) 별도 분기 없이 자연스럽게 밴드가 안 그려진다.
 */
function buildBarIndicatorSeries(
  candles: Candle[],
  periods: { ma1: number; ma2: number; bmsbSma?: number; bmsbEma?: number; rsi?: number },
): IndicatorSeries {
  const close = candles.map((c) => c.close);
  const nulls = new Array<number | null>(close.length).fill(null);
  return {
    dates: candles.map((c) => c.date),
    candles,
    close,
    ma50: sma(close, periods.ma1),
    ma200: sma(close, periods.ma2),
    ma50w: nulls,
    bmsbSma: periods.bmsbSma != null ? sma(close, periods.bmsbSma) : nulls,
    bmsbEma: periods.bmsbEma != null ? ema(close, periods.bmsbEma) : nulls,
    rsi14: rsi(close, periods.rsi ?? RSI_PERIOD),
  };
}

/**
 * 주봉 캔들 전용 지표 시리즈. 봉 자체가 이미 주 단위라 기간 상수를 일봉용
 * (50/200/350/140/147일)이 아니라 주봉용(50/200/20/21주)으로 바꿔 계산한다.
 */
export function buildWeeklyIndicatorSeries(candles: Candle[]): IndicatorSeries {
  return buildBarIndicatorSeries(candles, {
    ma1: WEEKLY_MA_SHORT_PERIOD,
    ma2: WEEKLY_MA_LONG_PERIOD,
    bmsbSma: WEEKLY_BMSB_SMA_PERIOD,
    bmsbEma: WEEKLY_BMSB_EMA_PERIOD,
  });
}

/**
 * 분봉 캔들 전용 지표 시리즈. 50/200분 이평선과 RSI(14, 분)는 그대로 계산되지만,
 * 불마켓밴드는 뺐다 — 20분/21분 SMA·EMA로 "불마켓밴드"라고 부를 근거가 어디에도
 * 없어서, 그렇게 하면 근거 없는 수치를 지표인 것처럼 보여주게 된다.
 */
export function buildMinuteIndicatorSeries(candles: Candle[]): IndicatorSeries {
  return buildBarIndicatorSeries(candles, { ma1: 50, ma2: 200 });
}

export function findCrosses(series: IndicatorSeries): CrossEvent[] {
  const events: CrossEvent[] = [];
  const { ma50, ma200, dates } = series;
  for (let i = 1; i < dates.length; i++) {
    const prev50 = ma50[i - 1];
    const prev200 = ma200[i - 1];
    const cur50 = ma50[i];
    const cur200 = ma200[i];
    if (prev50 == null || prev200 == null || cur50 == null || cur200 == null) continue;
    const wasBelow = prev50 <= prev200;
    const isAbove = cur50 > cur200;
    const wasAbove = prev50 >= prev200;
    const isBelow = cur50 < cur200;
    if (wasBelow && isAbove) {
      events.push({ index: i, date: dates[i], type: "golden" });
    } else if (wasAbove && isBelow) {
      events.push({ index: i, date: dates[i], type: "dead" });
    }
  }
  return events;
}

export function latestCrossState(events: CrossEvent[]): "golden" | "dead" | "unknown" {
  if (events.length === 0) return "unknown";
  return events[events.length - 1].type;
}

export function pctDelta(current: number, reference: number | null): number | null {
  if (reference == null || reference === 0) return null;
  return ((current - reference) / reference) * 100;
}
