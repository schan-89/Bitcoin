import { AVG_CYCLE_DAYS, computeCyclePosition } from "./cycle";
import type { RealDemandResult, SynthesisResult, ToneBucket, Zone, ZoneTone } from "../types";

function normalizeZoneTone(tone: ZoneTone | null): ToneBucket {
  if (tone === "긍정" || tone === "과열주의") return "긍정";
  if (tone === "위험" || tone === "경계") return "경계";
  return "중립"; // 관망
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function determineNextCheckpoint(zone: Zone | undefined, zones: Zone[], price: number | null): string {
  if (!zone || price == null) return "가격 데이터를 불러오면 다음 확인 지점이 표시됩니다.";
  const sorted = [...zones].sort((a, b) => a.min - b.min);
  const idx = sorted.findIndex((z) => z.id === zone.id);
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const prev = idx > 0 ? sorted[idx - 1] : null;

  const parts: string[] = [];
  if (Number.isFinite(zone.max) && next) {
    parts.push(`${fmtUsd(zone.max)} 상향 돌파 시 '${next.label}' 진입 확인`);
  }
  if (zone.min > 0 && prev) {
    parts.push(`${fmtUsd(zone.min)} 하향 이탈 시 '${prev.label}'로 복귀 확인`);
  }
  return parts.length > 0 ? parts.join(" / ") : "현재 구간의 상하단 기준선 유지 여부를 지켜보세요.";
}

export function synthesize(params: {
  zone: Zone | undefined;
  zones: Zone[];
  price: number | null;
  aScoreTotal: number;
  aScoreScored: number;
  realDemand: RealDemandResult;
}): SynthesisResult {
  const zoneTone = params.zone?.tone ?? null;
  const scoreTone: ToneBucket = params.aScoreTotal >= 4 ? "긍정" : params.aScoreTotal <= -4 ? "경계" : "중립";

  let confidence: string;
  let mismatch = false;
  let mismatchDetail: string | null = null;

  if (zoneTone === null) {
    confidence = "가격 데이터 부족 - 판단 보류";
  } else {
    const zoneBucket = normalizeZoneTone(zoneTone);
    if (zoneBucket === scoreTone) {
      confidence = "일치 - 판단 근거 뚜렷";
    } else {
      confidence = "불일치 - 신호 엇갈림, 보수적 해석 권장";
      mismatch = true;
      mismatchDetail = `가격 구간은 '${zoneTone}'을 가리키지만 A지표 총점(${params.aScoreTotal >= 0 ? "+" : ""}${params.aScoreTotal}/${params.aScoreScored})은 '${scoreTone}' 우세입니다.`;
    }
  }

  if (params.realDemand.verdict === "파생시장 효과 의심") {
    confidence = `판단 보류 권장 - ${confidence}`;
  }

  const nextCheck = determineNextCheckpoint(params.zone, params.zones, params.price);
  const cycle = computeCyclePosition();
  const cycleSummary = `고점+${cycle.daysSinceTop}일 (평균 ${AVG_CYCLE_DAYS}일 대비 ${(cycle.progressRatio * 100).toFixed(0)}%)`;

  const headline = zoneTone ? `${zoneTone} (${confidence})` : confidence;

  return {
    headline,
    zoneTone,
    zoneLabel: params.zone?.label ?? null,
    scoreTone,
    confidence,
    mismatch,
    mismatchDetail,
    nextCheck,
    cycleSummary,
  };
}
