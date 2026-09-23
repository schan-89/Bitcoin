import type { IndicatorTotals } from "../lib/aIndicators";

export function AIndicatorSummaryCard({ totals }: { totals: IndicatorTotals }) {
  const tone = totals.total >= 4 ? "positive" : totals.total <= -4 ? "warning" : "hold";
  return (
    <div className={`ai-summary-card ${tone}`}>
      <h2>A지표 요약</h2>
      <div className="ai-summary-total">
        총점 {totals.total >= 0 ? "+" : ""}
        {totals.total} / {totals.scored}
      </div>
      <div className="ai-summary-breakdown">
        <span className="up">긍정 {totals.positive}</span>
        <span className="neutral">대기 {totals.neutral}</span>
        <span className="down">경계 {totals.negative}</span>
        {totals.unknown > 0 && <span className="neutral">미입력 {totals.unknown}</span>}
      </div>
    </div>
  );
}
