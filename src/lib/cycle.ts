// 사이클 고점일과 평균 사이클 길이는 설계 문서의 예시값을 기본 설정값으로 사용합니다.
export const CYCLE_TOP_DATE = "2025-10-06";
export const AVG_CYCLE_DAYS = 383;

export interface CyclePosition {
  daysSinceTop: number;
  progressRatio: number; // daysSinceTop / AVG_CYCLE_DAYS
}

export function computeCyclePosition(today: Date = new Date(), topDate = CYCLE_TOP_DATE): CyclePosition {
  const top = new Date(`${topDate}T00:00:00Z`);
  const daysSinceTop = Math.floor((today.getTime() - top.getTime()) / 86400000);
  return { daysSinceTop, progressRatio: daysSinceTop / AVG_CYCLE_DAYS };
}
