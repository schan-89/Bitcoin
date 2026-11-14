import type { DerivativesEntry, EtfFlowEntry, RealDemandCheck, RealDemandResult } from "../types";

export const ETF_STREAK_TARGET = 3;
// 급등으로 간주하는 펀딩비 절대값(%/8h) 기준선 — 필요시 조정 가능
export const FUNDING_SPIKE_THRESHOLD_PCT = 0.08;
// 청산 후 "안정화"로 볼 미결제약정의 전일 대비 변동폭(%) 기준선
const OI_SWING_THRESHOLD_PCT = 8;
// 손으로 넣는 데이터라 입력이 끊기면 옛 값이 계속 "최신"으로 남는다. 이 일수를 넘긴
// 값으로는 판정하지 않는다. ETF는 주말·연휴에 거래가 없어 여유를 더 둔다.
export const ETF_STALE_DAYS = 5;
export const DERIV_STALE_DAYS = 3;

/** 입력 날짜(YYYY-MM-DD)가 오늘로부터 며칠 전인지. */
export function daysSince(date: string, today: Date = new Date()): number {
  const then = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((now - then) / 86400000);
}

/** 가장 최근 ETF 입력이 판정에 쓰기엔 너무 오래됐으면 그 경과 일수, 아니면 null. */
export function etfStaleDays(entries: EtfFlowEntry[], today: Date = new Date()): number | null {
  if (entries.length === 0) return null;
  const latest = entries.reduce((a, b) => (a.date > b.date ? a : b));
  const age = daysSince(latest.date, today);
  return age > ETF_STALE_DAYS ? age : null;
}

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
  today: Date = new Date(),
): RealDemandResult {
  const checks: RealDemandCheck[] = [];

  const streak = etfInflowStreak(etf);
  const etfStale = etfStaleDays(etf, today);
  const streakPassed = etf.length === 0 || etfStale !== null ? null : streak >= ETF_STREAK_TARGET;
  checks.push({
    label: `ETF 순유입 ${ETF_STREAK_TARGET}일 이상 연속`,
    passed: streakPassed,
    detail:
      etf.length === 0
        ? "ETF 데이터 없음"
        : etfStale !== null
          ? `마지막 입력이 ${etfStale}일 전 — 최신 데이터 필요`
          : `현재 ${streak}일 연속 순유입`,
  });

  const fundingSorted = deriv
    .filter((d) => d.fundingRatePct != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  let fundingPassed: boolean | null = null;
  let fundingDetail = "펀딩비 데이터 없음";
  if (fundingSorted.length > 0 && daysSince(fundingSorted[0].date, today) > DERIV_STALE_DAYS) {
    fundingDetail = `마지막 입력이 ${daysSince(fundingSorted[0].date, today)}일 전 — 최신 데이터 필요`;
  } else if (fundingSorted.length > 0) {
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
  if (oiSorted.length > 0 && daysSince(oiSorted[oiSorted.length - 1].date, today) > DERIV_STALE_DAYS) {
    oiDetail = `마지막 입력이 ${daysSince(oiSorted[oiSorted.length - 1].date, today)}일 전 — 최신 데이터 필요`;
  } else if (oiSorted.length >= 2) {
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
