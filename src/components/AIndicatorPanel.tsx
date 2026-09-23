import { useState } from "react";
import { MANUAL_TRISTATE_INDICATORS, REFERENCE_ONLY_INDICATOR } from "../lib/aIndicators";
import type { IndicatorResult, IndicatorScore, ManualIndicatorMap } from "../types";

const TRISTATE_OPTIONS: { score: IndicatorScore; label: string; cls: string }[] = [
  { score: 1, label: "긍정", cls: "up" },
  { score: 0, label: "대기", cls: "neutral" },
  { score: -1, label: "경계", cls: "down" },
];

function scoreBadge(score: IndicatorScore | null): { text: string; cls: string } {
  if (score === null) return { text: "❓", cls: "neutral" };
  if (score === 1) return { text: "긍정", cls: "up" };
  if (score === -1) return { text: "경계", cls: "down" };
  return { text: "대기", cls: "neutral" };
}

function NumericIndicatorRow({
  label,
  hint,
  value,
  onSave,
}: {
  label: string;
  hint: string;
  value: number | undefined;
  onSave: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  function handleBlur() {
    const v = Number(draft);
    if (draft !== "" && !Number.isNaN(v)) onSave(v);
  }

  return (
    <tr>
      <td>
        {label}
        <div className="indicator-hint">{hint}</div>
      </td>
      <td colSpan={2}>
        <input
          type="number"
          step="any"
          className="indicator-numeric-input"
          value={draft}
          placeholder="값 입력"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
    </tr>
  );
}

/** 가격 차트에 점선으로 겹쳐 그릴 수 있도록, 판정과 별개로 실제 가격도 받는 지표들. */
const CHART_LINE_INDICATOR_IDS = new Set(["realizedPrice", "balancedPrice"]);

function ChartPriceInput({ value, onSave }: { value: number | undefined; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");

  function handleBlur() {
    const v = Number(draft);
    if (draft !== "" && !Number.isNaN(v)) onSave(v);
  }

  return (
    <label className="chart-price-input">
      차트 표시용 가격($)
      <input
        type="number"
        step="any"
        value={draft}
        placeholder="선택 입력"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
      />
    </label>
  );
}

interface Props {
  results: IndicatorResult[];
  manual: ManualIndicatorMap;
  onSetTriState: (id: string, score: IndicatorScore) => void;
  onSetNumeric: (id: string, rawValue: number) => void;
  ewyNote: string;
  onSetEwyNote: (note: string) => void;
}

export function AIndicatorPanel({ results, manual, onSetTriState, onSetNumeric, ewyNote, onSetEwyNote }: Props) {
  const manualTriIds = new Set(MANUAL_TRISTATE_INDICATORS.map((d) => d.id));

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>A지표 ({results.length}개)</h2>
      </div>
      <p className="section-sub">
        자동 계산 지표는 위 데이터에서 그대로 가져오고, 수동 판단 지표는 직접 긍정/대기/경계를 선택하세요.
      </p>
      <table className="entry-table indicator-table">
        <thead>
          <tr>
            <th>지표</th>
            <th>판정</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            if (r.id === "mvrv") {
              return (
                <NumericIndicatorRow
                  key={r.id}
                  label="MVRV"
                  hint="1 미만 → 긍정(저평가), 3 이상 → 경계(과열)"
                  value={manual.mvrv?.rawValue}
                  onSave={(v) => onSetNumeric("mvrv", v)}
                />
              );
            }
            if (r.id === "dxy") {
              return (
                <NumericIndicatorRow
                  key={r.id}
                  label="달러 인덱스(DXY)"
                  hint="최근 변동률(%) 입력 — 하락 시 긍정, 상승 시 경계"
                  value={manual.dxy?.rawValue}
                  onSave={(v) => onSetNumeric("dxy", v)}
                />
              );
            }
            if (manualTriIds.has(r.id)) {
              const hint = MANUAL_TRISTATE_INDICATORS.find((d) => d.id === r.id)?.hint ?? "";
              const current = manual[r.id]?.score;
              return (
                <tr key={r.id}>
                  <td>
                    {r.label}
                    <div className="indicator-hint">{hint}</div>
                  </td>
                  <td colSpan={2}>
                    <div className="tristate-buttons">
                      {TRISTATE_OPTIONS.map((opt) => (
                        <button
                          key={opt.score}
                          type="button"
                          className={`tristate-btn ${opt.cls} ${current === opt.score ? "active" : ""}`}
                          onClick={() => onSetTriState(r.id, opt.score)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {CHART_LINE_INDICATOR_IDS.has(r.id) && (
                      <ChartPriceInput
                        value={manual[r.id]?.rawValue}
                        onSave={(v) => onSetNumeric(r.id, v)}
                      />
                    )}
                  </td>
                </tr>
              );
            }
            const badge = scoreBadge(r.score);
            return (
              <tr key={r.id}>
                <td>
                  {r.label} <span className="source-tag">자동</span>
                </td>
                <td>
                  <span className={`indicator-badge ${badge.cls}`}>{badge.text}</span>
                </td>
                <td className="check-detail">{r.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ewy-note">
        <label htmlFor="ewy-note-input">{REFERENCE_ONLY_INDICATOR.label}</label>
        <textarea
          id="ewy-note-input"
          rows={2}
          value={ewyNote}
          placeholder="반도체 동조 흐름 메모 (점수에는 반영되지 않음)"
          onChange={(e) => onSetEwyNote(e.target.value)}
        />
      </div>
    </div>
  );
}
