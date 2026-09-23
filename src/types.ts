export type ZoneTone = "위험" | "경계" | "관망" | "긍정" | "과열주의";

export interface Zone {
  id: string;
  min: number;
  max: number; // Infinity allowed for the top zone
  label: string;
  tone: ZoneTone;
}

export interface PricePoint {
  date: string; // ISO date (day granularity)
  close: number;
}

export interface Candle {
  /** Full ISO datetime — day-granularity for 1d/1w candles, minute-level for intraday. */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSeries {
  dates: string[];
  candles: Candle[];
  close: number[];
  ma50: (number | null)[];
  ma200: (number | null)[];
  /** 50주 이평선 — 일봉 기준 350일. 라방이 "가장 중요한 중장기 추세선"으로 보는 선. */
  ma50w: (number | null)[];
  /** Bull Market Support Band 하단/상단: 20주 SMA(140일)와 21주 EMA(147일). */
  bmsbSma: (number | null)[];
  bmsbEma: (number | null)[];
  rsi14: (number | null)[];
}

export interface CrossEvent {
  index: number;
  date: string;
  type: "golden" | "dead";
}

export interface EtfFlowEntry {
  date: string; // ISO date, one entry per day
  netFlowUsdM: number; // net flow in USD millions, positive = inflow
}

export interface DerivativesEntry {
  date: string; // ISO date, one entry per day
  liquidationUsdM?: number; // total liquidations that day, USD millions
  openInterestUsdM?: number; // total open interest, USD millions
  fundingRatePct?: number; // funding rate, % per 8h
}

export interface RealDemandCheck {
  label: string;
  passed: boolean | null; // null = insufficient data to judge
  detail: string;
}

export interface RealDemandResult {
  verdict: "실수요 가능성 높음" | "파생시장 효과 의심" | "판단 보류";
  checks: RealDemandCheck[];
}

export interface TradePlan {
  holdingsQty: number; // total holdings, e.g. BTC
  targetSellRatioPct: number; // target % of holdings to sell
}

export interface TradePlanChange {
  timestamp: string; // ISO datetime of the edit
  field: "holdingsQty" | "targetSellRatioPct";
  oldValue: number;
  newValue: number;
}

export interface TradeEntry {
  id: string;
  date: string; // ISO date
  side: "buy" | "sell";
  quantity: number;
  price: number; // execution price, USD
}

export interface TradeStats {
  totalTargetSellQty: number;
  cumulativeSoldQty: number;
  remainingTargetQty: number;
  avgSellPrice: number | null;
  sellProgressPct: number; // 0-100
  cumulativeBoughtQty: number;
  avgBuyPrice: number | null;
}

// A지표: 1=긍정, 0=대기/중립, -1=경계
export type IndicatorScore = 1 | 0 | -1;
export type IndicatorSource = "auto" | "manual";

export interface IndicatorResult {
  id: string;
  label: string;
  score: IndicatorScore | null; // null = 데이터 없음/판단 불가
  detail: string;
  source: IndicatorSource;
}

export interface ManualIndicatorState {
  score: IndicatorScore;
  rawValue?: number; // for threshold-classified indicators (MVRV, DXY)
  updatedAt: string; // ISO datetime
}

export type ManualIndicatorMap = Record<string, ManualIndicatorState>;

export interface DailyScoreSnapshot {
  date: string; // ISO date, one snapshot per day
  total: number;
}

export type ToneBucket = "긍정" | "경계" | "중립";

export interface SynthesisResult {
  headline: string;
  zoneTone: ZoneTone | null;
  zoneLabel: string | null;
  scoreTone: ToneBucket;
  confidence: string;
  mismatch: boolean;
  mismatchDetail: string | null;
  nextCheck: string;
  cycleSummary: string;
}

export interface BoundaryProximity {
  key: string; // `${zoneId}:${boundaryType}` — stable key for de-duping alerts
  zoneId: string;
  zoneLabel: string;
  boundaryPrice: number;
  boundaryType: "min" | "max";
  distancePct: number; // absolute distance from price, in %
}

export interface AlertLogEntry {
  timestamp: string; // ISO datetime
  zoneLabel: string;
  boundaryPrice: number;
  price: number;
}

/**
 * Where an asset's price comes from. Binance covers crypto automatically.
 * Finnhub covers US-listed stocks/ETFs automatically, but only with a
 * user-supplied API key (never committed — see lib/finnhub.ts) and only
 * current price, not historical candles, since that needs a paid tier.
 * Everything else (국내 주식 등) has no free no-auth browser-callable
 * source, so those are entered by hand.
 */
export type PriceSource =
  | { kind: "binance"; symbol: string } // e.g. "BTCUSDT"
  | { kind: "finnhub"; symbol: string } // e.g. "QQQ" — US-listed only
  | { kind: "manual" };

export interface Asset {
  id: string;
  name: string;
  /** 화면에 붙는 통화 기호 — 달러 자산은 "$", 국내 주식은 "₩". */
  currency: string;
  source: PriceSource;
  /** manual 소스일 때 사용자가 직접 넣는 현재가. */
  manualPrice?: number;
  manualPriceUpdatedAt?: string;
  ladder?: LadderPlan;
}

/**
 * 분할매수 계획. 라방 형식 그대로:
 * "SPY 2X: 720 → 660 달러 / 매 10달러 마다 3%씩 (현재 4% / 총 25%)"
 */
export interface LadderPlan {
  startPrice: number; // 매수를 시작하는 가격 (720)
  endPrice: number; // 끝까지 내려갔을 때의 가격 (660)
  stepPrice: number; // 매 단계 간격 (10)
  pctPerStep: number; // 단계마다 넣는 비중 % (3)
  currentPct: number; // 지금까지 실제로 채운 비중 % (4)
  totalPct: number; // 계획상 최대 비중 % (25)
}

export interface LadderStatus {
  /** 현재가 기준으로 발동됐어야 할 단계 수. */
  triggeredSteps: number;
  totalSteps: number;
  /** 발동 단계까지 누적됐어야 할 목표 비중 %. totalPct를 넘지 않는다. */
  targetPct: number;
  currentPct: number;
  /** 목표 - 현재. 양수면 아직 덜 샀다는 뜻. */
  gapPct: number;
  /** 다음 단계가 발동되는 가격. 이미 끝까지 내려왔으면 null. */
  nextTriggerPrice: number | null;
  /** 단계수 x 단계당 비중. 계획의 totalPct와 어긋나면 입력값이 잘못된 것이다. */
  plannedTotalPct: number;
  state: "시작 전" | "진행 중" | "계획 완료";
}
