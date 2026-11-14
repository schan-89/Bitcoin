import { judgeCycle } from "./cycle";
import {
  DERIV_STALE_DAYS,
  ETF_STREAK_TARGET,
  FUNDING_SPIKE_THRESHOLD_PCT,
  daysSince,
  etfInflowStreak,
  etfStaleDays,
} from "./realDemand";
import type {
  DerivativesEntry,
  EtfFlowEntry,
  IndicatorResult,
  IndicatorScore,
  ManualIndicatorMap,
  ToneBucket,
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

/** 지표 표를 읽기 쉽게 묶는 그룹. 목록에 없는 지표는 마지막 "기타" 그룹으로 간다. */
export const INDICATOR_GROUPS: { title: string; note: string; ids: string[] }[] = [
  { title: "추세", note: "이동평균 위/아래", ids: ["bullBand", "ma50w", "ma200", "ma50", "cross"] },
  {
    title: "가치 평가",
    note: "싼가 / 비싼가",
    ids: ["ma200w", "mayer", "weeklyRsi", "drawdown", "piCycle", "roiCycle"],
  },
  { title: "수급·파생", note: "직접 입력한 ETF·펀딩비", ids: ["etfFlow", "fundingRate"] },
  {
    title: "직접 판단",
    note: "긍정/대기/경계를 직접 선택",
    ids: [...MANUAL_TRISTATE_INDICATORS.map((d) => d.id), "mvrv", "dxy"],
  },
];

// EWY/EWJ는 설계 문서에서 "직접 신호화하지 않고 맥락 정보로만 사용"하도록 명시되어 있어 점수 집계에서 제외합니다.
export const REFERENCE_ONLY_INDICATOR = { id: "ewyEwj", label: "EWY/EWJ (참고용, 점수 미반영)" };

const MVRV_LOW = 1;
const MVRV_HIGH = 3;
const DXY_CHANGE_THRESHOLD_PCT = 0.2;
// 펀딩비가 이 값 아래(음수)면 공매도 쪽이 돈을 내며 쏠려 있다는 뜻 — 과열의 반대편.
const FUNDING_NEGATIVE_THRESHOLD_PCT = -0.01;

// 가치 평가 지표 기준선 — 널리 쓰이는 관례값이며 필요시 조정 가능.
const MA200W_NEAR_PCT = 10; // 200주선 위 이만큼 이내면 "근접"
const MAYER_LOW = 0.8;
const MAYER_HIGH = 2.4;
const WEEKLY_RSI_LOW = 30;
const WEEKLY_RSI_HIGH = 70;
const DRAWDOWN_DEEP_PCT = -50;

// 총점이 "판정된 지표 수"의 이 비율을 넘어야 긍정/경계 우세로 본다. 예전엔 ±4점 고정이라
// 미입력이 많으면 도달할 수 없었다. 19개가 전부 판정될 때 예전 기준(4점)과 같아지는 비율.
const SCORE_TONE_RATIO = 0.2;
const SCORE_TONE_MIN = 2;

export function scoreToneThreshold(known: number): number {
  return Math.max(SCORE_TONE_MIN, Math.round(known * SCORE_TONE_RATIO));
}

export function scoreTone(total: number, known: number): ToneBucket {
  const threshold = scoreToneThreshold(known);
  return total >= threshold ? "긍정" : total <= -threshold ? "경계" : "중립";
}

export interface AIndicatorInput {
  price: number | null;
  ma50: number | null;
  ma200: number | null;
  ma50w: number | null;
  bmsbSma: number | null;
  bmsbEma: number | null;
  crossState: "golden" | "dead" | "unknown";
  ma200w: number | null;
  weeklyRsi: number | null;
  ath: number | null;
  athDate: string | null;
  piShort: number | null;
  piLongX2: number | null;
  etfEntries: EtfFlowEntry[];
  derivEntries: DerivativesEntry[];
  manual: ManualIndicatorMap;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function computeIndicators(input: AIndicatorInput): IndicatorResult[] {
  const results: IndicatorResult[] = [];

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

  // ROI 사이클 — 고점일은 실제 최고가 날짜를 쓴다.
  const drawdownPct =
    input.price != null && input.ath != null && input.ath > 0
      ? ((input.price - input.ath) / input.ath) * 100
      : null;
  const cycle = judgeCycle(input.athDate, drawdownPct);
  results.push({ id: "roiCycle", label: "ROI 사이클", score: cycle.score, detail: cycle.detail, source: "auto" });

  // ── 가치 평가(싼가/비싼가) 지표: 위 이평선들과 달리 추세가 아니라 과열·바닥을 잰다 ──

  // 200주 이평선 — 과거 약세장 바닥이 이 선 부근에서 나왔다. 고점 신호는 주지 않는다.
  if (input.price != null && input.ma200w != null) {
    const pct = ((input.price - input.ma200w) / input.ma200w) * 100;
    const score: IndicatorScore = pct <= MA200W_NEAR_PCT ? 1 : 0;
    results.push({
      id: "ma200w",
      label: "200주 이평선",
      score,
      detail: `${fmtUsd(input.ma200w)} · 현재가 대비 ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%${pct < 0 ? " — 200주선 아래(바닥권)" : score === 1 ? " — 바닥권 근접" : ""}`,
      source: "auto",
    });
  } else {
    results.push({ id: "ma200w", label: "200주 이평선", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 메이어 배수 = 현재가 ÷ 200일선.
  if (input.price != null && input.ma200 != null && input.ma200 > 0) {
    const mayer = input.price / input.ma200;
    const score: IndicatorScore = mayer < MAYER_LOW ? 1 : mayer >= MAYER_HIGH ? -1 : 0;
    results.push({
      id: "mayer",
      label: "메이어 배수",
      score,
      detail: `${mayer.toFixed(2)} (${MAYER_LOW} 미만 저평가 · ${MAYER_HIGH} 이상 과열)`,
      source: "auto",
    });
  } else {
    results.push({ id: "mayer", label: "메이어 배수", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 주봉 RSI
  if (input.weeklyRsi != null) {
    const v = input.weeklyRsi;
    const score: IndicatorScore = v < WEEKLY_RSI_LOW ? 1 : v >= WEEKLY_RSI_HIGH ? -1 : 0;
    results.push({
      id: "weeklyRsi",
      label: "주봉 RSI(14)",
      score,
      detail: `${v.toFixed(1)} (${WEEKLY_RSI_LOW} 미만 과매도 · ${WEEKLY_RSI_HIGH} 이상 과매수)`,
      source: "auto",
    });
  } else {
    results.push({ id: "weeklyRsi", label: "주봉 RSI(14)", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 고점 대비 낙폭 — 깊을수록 바닥권 근거. 고점 신호는 주지 않는다.
  if (drawdownPct != null && input.ath != null) {
    const score: IndicatorScore = drawdownPct <= DRAWDOWN_DEEP_PCT ? 1 : 0;
    results.push({
      id: "drawdown",
      label: "고점 대비 낙폭",
      score,
      detail: `최고가 ${fmtUsd(input.ath)} 대비 ${drawdownPct.toFixed(1)}% (${DRAWDOWN_DEEP_PCT}% 이하 깊은 조정)`,
      source: "auto",
    });
  } else {
    results.push({ id: "drawdown", label: "고점 대비 낙폭", score: null, detail: "데이터 부족", source: "auto" });
  }

  // 파이 사이클 탑 — 111일선이 350일선×2를 넘으면 고점 신호. 바닥 신호는 주지 않는다.
  if (input.piShort != null && input.piLongX2 != null && input.piLongX2 > 0) {
    const ratio = (input.piShort / input.piLongX2) * 100;
    const score: IndicatorScore = input.piShort >= input.piLongX2 ? -1 : 0;
    results.push({
      id: "piCycle",
      label: "파이 사이클",
      score,
      detail:
        score === -1
          ? `111일선이 350일선×2 위 — 고점 신호`
          : `111일선이 350일선×2의 ${ratio.toFixed(0)}% — 고점 신호 없음`,
      source: "auto",
    });
  } else {
    results.push({ id: "piCycle", label: "파이 사이클", score: null, detail: "데이터 부족", source: "auto" });
  }

  // ETF 자금 흐름
  if (input.etfEntries.length === 0) {
    results.push({ id: "etfFlow", label: "ETF 자금 흐름", score: null, detail: "데이터 없음", source: "auto" });
  } else if (etfStaleDays(input.etfEntries) !== null) {
    results.push({
      id: "etfFlow",
      label: "ETF 자금 흐름",
      score: null,
      detail: `마지막 입력이 ${etfStaleDays(input.etfEntries)}일 전 — 최신 데이터 필요`,
      source: "auto",
    });
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
  } else if (daysSince(fundingSorted[0].date) > DERIV_STALE_DAYS) {
    results.push({
      id: "fundingRate",
      label: "펀딩비",
      score: null,
      detail: `마지막 입력이 ${daysSince(fundingSorted[0].date)}일 전 — 최신 데이터 필요`,
      source: "auto",
    });
  } else {
    const latest = fundingSorted[0].fundingRatePct as number;
    const score: IndicatorScore =
      latest >= FUNDING_SPIKE_THRESHOLD_PCT ? -1 : latest <= FUNDING_NEGATIVE_THRESHOLD_PCT ? 1 : 0;
    const note = score === -1 ? " — 롱 과열" : score === 1 ? " — 숏 쏠림" : "";
    results.push({ id: "fundingRate", label: "펀딩비", score, detail: `최근 ${latest.toFixed(3)}%${note}`, source: "auto" });
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
  known: number; // 실제로 판정이 난(미입력·데이터 부족이 아닌) 지표 수
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
  return { total, positive, negative, neutral, unknown, scored: results.length, known: results.length - unknown };
}
