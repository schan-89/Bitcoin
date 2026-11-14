import type { IndicatorScore } from "../types";

// 사이클 고점일과 평균 사이클 길이는 설계 문서의 예시값을 기본 설정값으로 사용합니다.
// 고점일은 가격 데이터가 있으면 실제 최고가 날짜로 대체된다 (resolveCycleTop) — 이 상수는
// 데이터를 못 받았을 때만 쓰는 예비값.
export const CYCLE_TOP_DATE = "2025-10-06";
export const AVG_CYCLE_DAYS = 383;

// 최고가에서 이만큼은 빠져야 "사이클 고점이 지나갔다"고 본다. 신고가를 갱신 중인
// 상승장에서 매일 "고점+0일 → 경계"가 찍히는 것을 막는다.
export const CYCLE_TOP_CONFIRM_DRAWDOWN_PCT = 20;
// 평균 길이의 90~130%를 바닥 구간으로 본다. 그 뒤로는 이 지표가 더 말해줄 게 없으므로
// 긍정을 무기한 유지하지 않고 대기로 돌린다.
export const CYCLE_WINDOW_START = 0.9;
export const CYCLE_WINDOW_END = 1.3;

export interface CyclePosition {
  daysSinceTop: number;
  progressRatio: number; // daysSinceTop / AVG_CYCLE_DAYS
}

export function computeCyclePosition(today: Date = new Date(), topDate = CYCLE_TOP_DATE): CyclePosition {
  const top = new Date(`${topDate}T00:00:00Z`);
  const daysSinceTop = Math.floor((today.getTime() - top.getTime()) / 86400000);
  return { daysSinceTop, progressRatio: daysSinceTop / AVG_CYCLE_DAYS };
}

export interface CycleJudgement {
  score: IndicatorScore;
  detail: string;
  /** 종합 판단 카드에 그대로 쓰는 한 줄 요약. */
  summary: string;
}

/**
 * @param athDate 데이터에서 찾은 최고가 날짜. 없으면 설계 문서 예비값을 쓴다.
 * @param drawdownPct 최고가 대비 현재가 낙폭(음수, %). 없으면 고점 확정 여부를 따지지 않는다.
 */
export function judgeCycle(
  athDate: string | null,
  drawdownPct: number | null,
  today: Date = new Date(),
): CycleJudgement {
  const topDate = athDate ?? CYCLE_TOP_DATE;
  const cycle = computeCyclePosition(today, topDate);
  const pct = (cycle.progressRatio * 100).toFixed(0);
  const base = `고점(${topDate})+${cycle.daysSinceTop}일 (평균 ${AVG_CYCLE_DAYS}일 대비 ${pct}%)`;

  if (drawdownPct != null && drawdownPct > -CYCLE_TOP_CONFIRM_DRAWDOWN_PCT) {
    const text = `최고가(${topDate}) 대비 ${drawdownPct.toFixed(1)}% — 사이클 고점 미확정`;
    return { score: 0, detail: text, summary: text };
  }
  if (cycle.progressRatio > CYCLE_WINDOW_END) {
    const text = `${base} — 평균 길이를 넘김, 판단 근거 약함`;
    return { score: 0, detail: text, summary: text };
  }
  const score: IndicatorScore =
    cycle.progressRatio >= CYCLE_WINDOW_START ? 1 : cycle.progressRatio < 0.5 ? -1 : 0;
  return { score, detail: base, summary: base };
}
