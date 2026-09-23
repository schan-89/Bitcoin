import type { RealDemandResult } from "../types";

function checkIcon(passed: boolean | null): string {
  if (passed === null) return "❓";
  return passed ? "✅" : "⚠️";
}

const VERDICT_CLASS: Record<RealDemandResult["verdict"], string> = {
  "실수요 가능성 높음": "positive",
  "파생시장 효과 의심": "warning",
  "판단 보류": "hold",
};

export function RealDemandCard({ result }: { result: RealDemandResult }) {
  return (
    <div className={`real-demand-card ${VERDICT_CLASS[result.verdict]}`}>
      <h2>실수요 판정</h2>
      <div className="real-demand-verdict">{result.verdict}</div>
      <ul className="real-demand-checklist">
        {result.checks.map((c) => (
          <li key={c.label}>
            <span className="check-icon">{checkIcon(c.passed)}</span>
            <span className="check-label">{c.label}</span>
            <span className="check-detail">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
