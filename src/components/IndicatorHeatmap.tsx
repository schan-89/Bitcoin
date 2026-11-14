import type { IndicatorResult } from "../types";

function cellClass(score: IndicatorResult["score"]): string {
  if (score === null) return "cell-unknown";
  if (score === 1) return "cell-positive";
  if (score === -1) return "cell-negative";
  return "cell-neutral";
}

function stateText(score: IndicatorResult["score"]): string {
  if (score === null) return "미입력";
  if (score === 1) return "긍정";
  if (score === -1) return "경계";
  return "대기";
}

export function IndicatorHeatmap({ results }: { results: IndicatorResult[] }) {
  return (
    <div className="indicator-heatmap">
      {results.map((r) => (
        <div key={r.id} className={`heatmap-cell ${cellClass(r.score)}`} title={r.detail}>
          <span className="heatmap-label">{r.label}</span>
          <span className="heatmap-state">{stateText(r.score)}</span>
        </div>
      ))}
    </div>
  );
}
