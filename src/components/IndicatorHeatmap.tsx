import type { IndicatorResult } from "../types";

function cellClass(score: IndicatorResult["score"]): string {
  if (score === null) return "cell-unknown";
  if (score === 1) return "cell-positive";
  if (score === -1) return "cell-negative";
  return "cell-neutral";
}

export function IndicatorHeatmap({ results }: { results: IndicatorResult[] }) {
  return (
    <div className="indicator-heatmap">
      {results.map((r) => (
        <div key={r.id} className={`heatmap-cell ${cellClass(r.score)}`} title={r.detail}>
          {r.label}
        </div>
      ))}
    </div>
  );
}
