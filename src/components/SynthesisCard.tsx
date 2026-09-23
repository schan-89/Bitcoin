import type { SynthesisResult } from "../types";

function toneClass(tone: SynthesisResult["scoreTone"] | SynthesisResult["zoneTone"]): string {
  if (tone === "긍정" || tone === "과열주의") return "up";
  if (tone === "경계" || tone === "위험") return "down";
  return "neutral";
}

interface Props {
  result: SynthesisResult;
  aScoreTotal: number;
  aScoreScored: number;
  realDemandVerdict: string;
}

export function SynthesisCard({ result, aScoreTotal, aScoreScored, realDemandVerdict }: Props) {
  return (
    <div className={`synthesis-card ${result.mismatch ? "mismatch" : toneClass(result.zoneTone ?? result.scoreTone)}`}>
      <div className="synthesis-headline">지금 상태: {result.headline}</div>

      <div className="synthesis-rows">
        <div className="synthesis-row">
          <span className="synthesis-label">가격 위치</span>
          <span className="synthesis-value">
            {result.zoneLabel ?? "데이터 없음"}
            {result.zoneTone && <span className={`tone-chip ${toneClass(result.zoneTone)}`}>{result.zoneTone}</span>}
          </span>
        </div>
        <div className="synthesis-row">
          <span className="synthesis-label">A지표 점수</span>
          <span className="synthesis-value">
            {aScoreTotal >= 0 ? "+" : ""}
            {aScoreTotal} / {aScoreScored}
            <span className={`tone-chip ${toneClass(result.scoreTone)}`}>{result.scoreTone} 우세</span>
          </span>
        </div>
        <div className="synthesis-row">
          <span className="synthesis-label">실수요 판정</span>
          <span className="synthesis-value">{realDemandVerdict}</span>
        </div>
        <div className="synthesis-row">
          <span className="synthesis-label">사이클 위치</span>
          <span className="synthesis-value">{result.cycleSummary}</span>
        </div>
      </div>

      <div className="synthesis-next-check">
        <strong>다음에 확인할 것:</strong> {result.nextCheck}
      </div>

      {result.mismatch && result.mismatchDetail && (
        <div className="mismatch-warning">
          <div className="mismatch-title">⚠ 신호 불일치</div>
          <p>{result.mismatchDetail}</p>
          <p>실수요 확인 전까지 판단 보류를 권장합니다.</p>
        </div>
      )}
    </div>
  );
}
