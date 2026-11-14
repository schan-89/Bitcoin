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
  const signed = `${aScoreTotal >= 0 ? "+" : ""}${aScoreTotal}`;

  return (
    <section className={`hero ${result.mismatch ? "mismatch" : toneClass(result.zoneTone ?? result.scoreTone)}`}>
      <div className="hero-title-row">
        <h2 className="hero-title">{result.zoneLabel ?? "가격 데이터 대기 중"}</h2>
        {result.zoneTone && <span className={`tone-chip ${toneClass(result.zoneTone)}`}>{result.zoneTone}</span>}
      </div>
      <p className="hero-verdict">{result.confidence}</p>

      <dl className="hero-tiles">
        <div className="hero-tile">
          <dt>A지표 점수</dt>
          <dd>
            {signed}
            <small> / {aScoreScored}</small>
          </dd>
          <span className={`tone-chip ${toneClass(result.scoreTone)}`}>{result.scoreTone} 우세</span>
        </div>
        <div className="hero-tile">
          <dt>실수요 판정</dt>
          <dd className="hero-tile-text">{realDemandVerdict}</dd>
        </div>
        <div className="hero-tile wide">
          <dt>사이클 위치</dt>
          <dd className="hero-tile-text">{result.cycleSummary}</dd>
        </div>
      </dl>

      <p className="hero-next">
        <strong>다음에 확인할 것</strong>
        {result.nextCheck}
      </p>

      {result.mismatch && result.mismatchDetail && (
        <div className="mismatch-warning" role="note">
          <div className="mismatch-title">신호 불일치</div>
          <p>{result.mismatchDetail}</p>
          <p>실수요 확인 전까지 판단 보류를 권장합니다.</p>
        </div>
      )}
    </section>
  );
}
