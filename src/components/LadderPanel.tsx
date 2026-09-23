import { useState } from "react";
import { computeLadderStatus } from "../lib/ladder";
import type { Asset, LadderPlan } from "../types";

const EMPTY_PLAN: LadderPlan = {
  startPrice: 0,
  endPrice: 0,
  stepPrice: 0,
  pctPerStep: 0,
  currentPct: 0,
  totalPct: 0,
};

const FIELDS: { key: keyof LadderPlan; label: string }[] = [
  { key: "startPrice", label: "시작가" },
  { key: "endPrice", label: "종료가" },
  { key: "stepPrice", label: "단계 간격" },
  { key: "pctPerStep", label: "단계당 %" },
  { key: "totalPct", label: "총 목표 %" },
  { key: "currentPct", label: "현재 비중 %" },
];

interface Props {
  asset: Asset;
  price: number | null;
  onSave: (plan: LadderPlan) => void;
}

export function LadderPanel({ asset, price, onSave }: Props) {
  const plan = asset.ladder ?? EMPTY_PLAN;
  const [draft, setDraft] = useState<LadderPlan>(plan);
  const [editing, setEditing] = useState(!asset.ladder);

  const status = computeLadderStatus(plan, price);
  const cur = asset.currency;
  const configured = asset.ladder != null && status.totalSteps > 0;
  const mismatch = configured && status.plannedTotalPct !== plan.totalPct;

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>분할매수 계획</h2>
        <button type="button" className="link-btn" onClick={() => { setDraft(plan); setEditing((v) => !v); }}>
          {editing ? "취소" : "수정"}
        </button>
      </div>
      <p className="section-sub">
        라방 형식 그대로 입력하세요. 예) "720 → 660 달러 / 매 10달러 마다 3%씩 (현재 4% / 총 25%)"
      </p>

      {editing ? (
        <>
          <div className="ladder-form">
            {FIELDS.map((f) => (
              <label key={f.key} className="field-label">
                {f.label}
                <input
                  type="number"
                  step="any"
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="settings-actions">
            <button type="button" className="primary" onClick={handleSave}>
              저장
            </button>
          </div>
        </>
      ) : !configured ? (
        <p className="section-sub">계획이 아직 없습니다. "수정"을 눌러 입력하세요.</p>
      ) : (
        <>
          <div className="ladder-summary">
            {cur}
            {plan.startPrice.toLocaleString()} → {cur}
            {plan.endPrice.toLocaleString()} / 매 {cur}
            {plan.stepPrice.toLocaleString()}마다 {plan.pctPerStep}%씩
          </div>

          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${status.totalSteps > 0 ? (status.triggeredSteps / status.totalSteps) * 100 : 0}%` }}
            />
          </div>
          <div className="progress-caption">
            {status.state} · {status.triggeredSteps} / {status.totalSteps}단계 발동
            {status.nextTriggerPrice != null && (
              <>
                {" "}
                · 다음 단계 {cur}
                {status.nextTriggerPrice.toLocaleString()}
              </>
            )}
          </div>

          <div className="summary-grid">
            <div className="summary-cell">
              <span className="label">지금까지 채웠어야 할 비중</span>
              <span className="value">{status.targetPct}%</span>
            </div>
            <div className="summary-cell">
              <span className="label">실제 현재 비중</span>
              <span className="value">{status.currentPct}%</span>
            </div>
            <div className="summary-cell">
              <span className="label">차이</span>
              <span className={`value ${status.gapPct > 0 ? "down" : "up"}`}>
                {status.gapPct > 0 ? "+" : ""}
                {Number(status.gapPct.toFixed(2))}%
                <span className="ladder-gap-note">
                  {status.gapPct > 0 ? " 덜 채움" : status.gapPct < 0 ? " 앞서 채움" : " 일치"}
                </span>
              </span>
            </div>
          </div>

          {mismatch && (
            <p className="ladder-warning">
              ⚠ 계획 수치 확인 필요: {status.totalSteps}단계 × {plan.pctPerStep}% ={" "}
              <strong>{status.plannedTotalPct}%</strong>인데 총 목표는 {plan.totalPct}%로 적혀 있습니다.
            </p>
          )}

          {price == null && <p className="section-sub">현재가가 없어 단계 판정을 못 합니다. 가격을 입력하세요.</p>}
        </>
      )}
    </div>
  );
}
