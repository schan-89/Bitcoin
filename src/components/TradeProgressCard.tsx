import type { TradeStats } from "../types";

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function TradeProgressCard({ stats }: { stats: TradeStats }) {
  return (
    <div className="trade-progress-card">
      <h2>매도 계획 진행률</h2>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${stats.sellProgressPct}%` }} />
      </div>
      <div className="progress-caption">
        누적 매도 {fmtQty(stats.cumulativeSoldQty)} / 목표 {fmtQty(stats.totalTargetSellQty)} (
        {stats.sellProgressPct.toFixed(1)}%)
      </div>
      <div className="summary-grid">
        <div className="summary-cell">
          <span className="label">잔여 목표</span>
          <span className="value">{fmtQty(stats.remainingTargetQty)}</span>
        </div>
        <div className="summary-cell">
          <span className="label">평균 매도가</span>
          <span className="value">{fmtUsd(stats.avgSellPrice)}</span>
        </div>
        <div className="summary-cell">
          <span className="label">누적 매수량 / 평균 매수가</span>
          <span className="value">
            {fmtQty(stats.cumulativeBoughtQty)} / {fmtUsd(stats.avgBuyPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}
