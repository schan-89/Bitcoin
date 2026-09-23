import { AVG_CYCLE_DAYS, computeCyclePosition } from "./cycle";
import { ETF_STREAK_TARGET, FUNDING_SPIKE_THRESHOLD_PCT, etfInflowStreak } from "./realDemand";
import type {
  DerivativesEntry,
  EtfFlowEntry,
  IndicatorResult,
  IndicatorScore,
  ManualIndicatorMap,
} from "../types";

/** Manual indicators judged directly by the user as 긍정/대기/경계 (no formula given in the design doc). */
export const MANUAL_TRISTATE_INDICATORS: { id: string; label: string; hint: string }[] = [
  { id: "realizedPrice", label: "실현가격", hint: "현재가와 괴리가 클수록 바닥권 근거(긍정)" },
  { id: "balancedPrice", label: "밸런스가격", hint: "현재가가 근접할수록 패닉/항복 국면(경계)" },
  { id: "btcLiquidityRatio", label: "비트/유동성 비율", hint: "과거 저항 접근 시 경계, 이탈 시 긍정" },
  { id: "btcGoldRatio", label: "비트/금 비율", hint: "금 대비 상대강도 약화 시 경계" },
  { id: "btcStockRatio", label: "비트/증시 비율", hint: "증시 대비 상대강도 강화 시 긍정" },
  { id: "longTermHolders", label: "장기보유자 증감", hint: "순증가 지속 → 긍정, 둔화·감소 → 경계" },
  { id: "whaleAccumulation", label: "고래 매집", hint: "순증가 지속 → 긍정" },
  { id: "divergence", label: "다이버전스", hint: "가격-거래량 괴리 발생 시 경계" },
  { id: "mstrNav", label: "MSTR NAV 할인율", hint: "할인 축소·프리미엄 전환 시 긍정" },
];

// EWY/EWJ는 설계 문서에서 "직접 신호화하지 않고 맥락 정보로만 사용"하도록 명시되어 있어 점수 집계에서 제외합니다.
export const REFERENCE_ONLY_INDICATOR = { id: "ewyEwj", label: "EWY/EWJ (참고용, 점수 미반영)" };

const MVRV_LOW = 1;
const MVRV_HIGH = 3;
const DXY_CHANGE_THRESHOLD_PCT = 0.2;

export interface AIndicatorInput {
  price: number | null;
  ma50: number | null;
  ma200: number | null;
  ma50w: number | null;
  bmsbSma: number | null;
  bmsbEma: number | null;
  crossState: "golden" | "dead" | "unknown";
  etfEntries: EtfFlowEntry[];
  derivEntries: DerivativesEntry[];
  manual: ManualIndicatorMap;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function computeIndicators(input: AIndicatorInput): IndicatorResult[] {
  const results: IndicatorResult[] = [];

  // 불마켓밴드 (자동 근사): 200일 SMA/EMA 사이 영역. 정확한 공식은 라방 자료로 확정 필요(문서 3-3-0 참고).
  // 불마켓밴드(Bull Market Support Band) = 20주 SMA / 21주 EMA.
  // 밴드 위=상승추세 유지(긍정), 밴드 아래=추세 이탈(경계), 밴드 안=공방 중(대기).
  if (input.price != null && input.bmsbSma != null && input.bmsbEma != null) {
    const top = Math.max(input.bmsbSma, input.bmsbEma);
    const bottom = Math.min(input.bmsbSma, input.bmsbEma);
    let score: IndicatorScore;
    let detail: string;
    if (input.price > top) {
      score = 1;
      detail = `밴드 상단(${fmtUsd(top)}) 위 — 상승추세 유지`;
    } else if (input.price < bottom) {
      score = -1;
      detail = `밴드 하단(${fmtUsd(bottom)}) 아래 — 추세 이탈`;
    } else {
      score = 0;
      detail = `밴드 내부 (${fmtUsd(bottom)}~${fmtUsd(top)}) — 공방 중`;
    }
    results.push({ id: "bullBand", label: "불마켓밴드(20주SMA/21주EMA)", score, detail, source: "auto" });
  } else {
    results.push({ id: "bullBand", label: "불마켓밴드(20주SMA/21주EMA)", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 50주 이평선 — 라방이 "가장 중요한 중장기 추세선"으로 보는 선.
  if (input.price != null && input.ma50w != null) {
    const score: IndicatorScore = input.price > input.ma50w ? 1 : -1;
    const pct = ((input.price - input.ma50w) / input.ma50w) * 100;
    results.push({
      id: "ma50w",
      label: "50주 이평선",
      score,
      detail: `${fmtUsd(input.ma50w)} · 현재가 대비 ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
      source: "auto",
    });
  } else {
    results.push({ id: "ma50w", label: "50주 이평선", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 200일 / 50일 이평선
  if (input.price != null && input.ma200 != null) {
    const score: IndicatorScore = input.price > input.ma200 ? 1 : -1;
    const pct = ((input.price - input.ma200) / input.ma200) * 100;
    results.push({ id: "ma200", label: "200일 이평선", score, detail: `현재가 대비 ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, source: "auto" });
  } else {
    results.push({ id: "ma200", label: "200일 이평선", score: null, detail: "데이터 없음", source: "auto" });
  }
  if (input.price != null && input.ma50 != null) {
    const score: IndicatorScore = input.price > input.ma50 ? 1 : -1;
    const pct = ((input.price - input.ma50) / input.ma50) * 100;
    results.push({ id: "ma50", label: "50일 이평선", score, detail: `현재가 대비 ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, source: "auto" });
  } else {
    results.push({ id: "ma50", label: "50일 이평선", score: null, detail: "데이터 없음", source: "auto" });
  }

  // 데드/골든크로스
  if (input.crossState === "unknown") {
    results.push({ id: "cross", label: "골든/데드크로스", score: null, detail: "판단 보류", source: "auto" });
  } else {
    results.push({
      id: "cross",
      label: "골든/데드크로스",
      score: input.crossState === "golden" ? 1 : -1,
      detail: input.crossState === "golden" ? "골든크로스 상태" : "데드크로스 상태",
      source: "auto",
    });
  }

  // ROI 사이클
  const cycle = computeCyclePosition();
  const cycleScore: IndicatorScore = cycle.progressRatio >= 0.9 ? 1 : cycle.progressRatio < 0.5 ? -1 : 0;
  results.push({
    id: "roiCycle",
    label: "ROI 사이클",
    score: cycleScore,
    detail: `고점+${cycle.daysSinceTop}일 (평균 ${AVG_CYCLE_DAYS}일 대비 ${(cycle.progressRatio * 100).toFixed(0)}%)`,
    source: "auto",
  });

  // ETF 자금 흐름
  if (input.etfEntries.length === 0) {
    results.push({ id: "etfFlow", label: "ETF 자금 흐름", score: null, detail: "데이터 없음", source: "auto" });
  } else {
    const streak = etfInflowStreak(input.etfEntries);
    const latest = [...input.etfEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
    const score: IndicatorScore = streak >= ETF_STREAK_TARGET ? 1 : latest.netFlowUsdM < 0 ? -1 : 0;
    results.push({ id: "etfFlow", label: "ETF 자금 흐름", score, detail: `${streak}일 연속 순유입`, source: "auto" });
  }

  // 펀딩비
  const fundingSorted = input.derivEntries
    .filter((d) => d.fundingRatePct != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (fundingSorted.length === 0) {
    results.push({ id: "fundingRate", label: "펀딩비", score: null, detail: "데이터 없음", source: "auto" });
  } else {
    const latest = fundingSorted[0].fundingRatePct as number;
    const score: IndicatorScore = latest >= FUNDING_SPIKE_THRESHOLD_PCT ? -1 : 0;
    results.push({ id: "fundingRate", label: "펀딩비", score, detail: `최근 ${latest.toFixed(3)}%`, source: "auto" });
  }

  // 수동 판단 지표 9종
  for (const def of MANUAL_TRISTATE_INDICATORS) {
    const state = input.manual[def.id];
    results.push({
      id: def.id,
      label: def.label,
      score: state ? state.score : null,
      detail: state ? `수동 입력 (${new Date(state.updatedAt).toLocaleDateString("ko-KR")})` : "입력 필요",
      source: "manual",
    });
  }

  // MVRV (수동 숫자 입력, 자동 임계값 판정)
  const mvrvState = input.manual.mvrv;
  if (mvrvState?.rawValue != null) {
    const v = mvrvState.rawValue;
    const score: IndicatorScore = v < MVRV_LOW ? 1 : v >= MVRV_HIGH ? -1 : 0;
    results.push({ id: "mvrv", label: "MVRV", score, detail: `MVRV ${v.toFixed(2)}`, source: "manual" });
  } else {
    results.push({ id: "mvrv", label: "MVRV", score: null, detail: "입력 필요", source: "manual" });
  }

  // 달러 인덱스(DXY) (수동 숫자 입력: 최근 변동률 %, 자동 판정)
  const dxyState = input.manual.dxy;
  if (dxyState?.rawValue != null) {
    const v = dxyState.rawValue;
    const score: IndicatorScore = v < -DXY_CHANGE_THRESHOLD_PCT ? 1 : v > DXY_CHANGE_THRESHOLD_PCT ? -1 : 0;
    results.push({
      id: "dxy",
      label: "달러 인덱스(DXY)",
      score,
      detail: `최근 변동 ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
      source: "manual",
    });
  } else {
    results.push({ id: "dxy", label: "달러 인덱스(DXY)", score: null, detail: "입력 필요", source: "manual" });
  }

  return results;
}

export interface IndicatorTotals {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  unknown: number;
  scored: number; // total indicator count excluding reference-only ones
}

export function summarizeIndicators(results: IndicatorResult[]): IndicatorTotals {
  let total = 0;
  let positive = 0;
  let negative = 0;
  let neutral = 0;
  let unknown = 0;
  for (const r of results) {
    if (r.score === null) {
      unknown++;
      continue;
    }
    total += r.score;
    if (r.score === 1) positive++;
    else if (r.score === -1) negative++;
    else neutral++;
  }
  return { total, positive, negative, neutral, unknown, scored: results.length };
}
