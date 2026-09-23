import { useState } from "react";
import type { TradePlan, TradePlanChange } from "../types";

interface Props {
  plan: TradePlan;
  history: TradePlanChange[];
  onSave: (next: TradePlan) => void;
}

export function TradePlanPanel({ plan, history, onSave }: Props) {
  const [holdingsQty, setHoldingsQty] = useState(String(plan.holdingsQty));
  const [targetSellRatioPct, setTargetSellRatioPct] = useState(String(plan.targetSellRatioPct));
  const [historyOpen, setHistoryOpen] = useState(false);

  const dirty = Number(holdingsQty) !== plan.holdingsQty || Number(targetSellRatioPct) !== plan.targetSellRatioPct;

  function handleSave() {
    const nextHoldings = Number(holdingsQty);
    const nextRatio = Number(targetSellRatioPct);
    if (Number.isNaN(nextHoldings) || Number.isNaN(nextRatio)) return;
    onSave({ holdingsQty: nextHoldings, targetSellRatioPct: nextRatio });
  }

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>매매 계획</h2>
        {history.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setHistoryOpen((v) => !v)}>
            변경 이력 ({history.length}) {historyOpen ? "숨기기" : "보기"}
          </button>
        )}
      </div>

      <p className="section-sub">
        한번 세운 계획은 감정적으로 자주 바꾸지 않는 것을 권장합니다. 값을 바꾸면 변경 이력에 기록됩니다.
      </p>

      <div className="entry-form">
        <label className="field-label">
          보유량
          <input
            type="number"
            step="any"
            value={holdingsQty}
            onChange={(e) => setHoldingsQty(e.target.value)}
          />
        </label>
        <label className="field-label">
          목표 매도 비율(%)
          <input
            type="number"
            step="any"
            value={targetSellRatioPct}
            onChange={(e) => setTargetSellRatioPct(e.target.value)}
          />
        </label>
        <button type="button" disabled={!dirty} onClick={handleSave}>
          저장
        </button>
      </div>

      {historyOpen && (
        <table className="entry-table">
          <thead>
            <tr>
              <th>변경 시각</th>
              <th>항목</th>
              <th>이전 값</th>
              <th>변경 값</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((h) => (
              <tr key={h.timestamp + h.field}>
                <td>{new Date(h.timestamp).toLocaleString("ko-KR")}</td>
                <td>{h.field === "holdingsQty" ? "보유량" : "목표 매도 비율(%)"}</td>
                <td>{h.oldValue.toLocaleString()}</td>
                <td>{h.newValue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
