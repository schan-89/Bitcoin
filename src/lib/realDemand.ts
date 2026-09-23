import type { DerivativesEntry, EtfFlowEntry, RealDemandCheck, RealDemandResult } from "../types";

export const ETF_STREAK_TARGET = 3;
// 급등으로 간주하는 펀딩비 절대값(%/8h) 기준선 — 필요시 조정 가능
export const FUNDING_SPIKE_THRESHOLD_PCT = 0.08;
// 청산 후 "안정화"로 볼 미결제약정의 전일 대비 변동폭(%) 기준선
const OI_SWING_THRESHOLD_PCT = 8;

/** Counts consecutive net-inflow days ending at the most recent entry. */
export function etfInflowStreak(entries: EtfFlowEntry[]): number {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const e of sorted) {
    if (e.netFlowUsdM > 0) streak++;
    else break;
  }
  return streak;
}

export function evaluateRealDemand(
  etf: EtfFlowEntry[],
  deriv: DerivativesEntry[],
): RealDemandResult {
  const checks: RealDemandCheck[] = [];

  const streak = etfInflowStreak(etf);
  const streakPassed = etf.length === 0 ? null : streak >= ETF_STREAK_TARGET;
  checks.push({
    label: `ETF 순유입 ${ETF_STREAK_TARGET}일 이상 연속`,
    passed: streakPassed,
    detail: etf.length === 0 ? "ETF 데이터 없음" : `현재 ${streak}일 연속 순유입`,
  });

  const fundingSorted = deriv
    .filter((d) => d.fundingRatePct != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  let fundingPassed: boolean | null = null;
  let fundingDetail = "펀딩비 데이터 없음";
  if (fundingSorted.length > 0) {
    const latest = fundingSorted[0].fundingRatePct as number;
    fundingPassed = Math.abs(latest) < FUNDING_SPIKE_THRESHOLD_PCT;
    fundingDetail = `최근 펀딩비 ${latest.toFixed(3)}% (기준 ±${FUNDING_SPIKE_THRESHOLD_PCT}%)`;
  }
  checks.push({ label: "펀딩비 급등 없음", passed: fundingPassed, detail: fundingDetail });

  const oiSorted = deriv
    .filter((d) => d.openInterestUsdM != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  let oiPassed: boolean | null = null;
  let oiDetail = "미결제약정 데이터 없음";
  if (oiSorted.length >= 2) {
    const prev = oiSorted[oiSorted.length - 2].openInterestUsdM as number;
    const last = oiSorted[oiSorted.length - 1].openInterestUsdM as number;
    const swingPct = prev === 0 ? 0 : Math.abs((last - prev) / prev) * 100;
    oiPassed = swingPct < OI_SWING_THRESHOLD_PCT;
    oiDetail = `전일 대비 변동 ${swingPct.toFixed(1)}% (기준 ${OI_SWING_THRESHOLD_PCT}% 이내)`;
  } else if (oiSorted.length === 1) {
    oiDetail = "비교할 이전 데이터 부족";
  }
  checks.push({ label: "미결제약정 청산 후 안정화", passed: oiPassed, detail: oiDetail });

  const anyUnknown = checks.some((c) => c.passed === null);
  const allPassed = checks.every((c) => c.passed === true);

  let verdict: RealDemandResult["verdict"];
  if (anyUnknown) verdict = "판단 보류";
  else if (allPassed) verdict = "실수요 가능성 높음";
  else verdict = "파생시장 효과 의심";

  return { verdict, checks };
}
