import type { Zone } from "../types";

const TONE_COLOR: Record<string, string> = {
  위험: "#c0392b",
  경계: "#e0a800",
  관망: "#8a8a8a",
  긍정: "#2e8b57",
  과열주의: "#c0782b",
};

interface Props {
  zones: Zone[];
  price: number;
}

export function ZoneGauge({ zones, price }: Props) {
  const sorted = [...zones].sort((a, b) => a.min - b.min);
  const finiteMax = sorted.reduce(
    (acc, z) => (Number.isFinite(z.max) ? Math.max(acc, z.max) : acc),
    sorted[0]?.min ?? 0,
  );
  const rangeMin = sorted[0]?.min ?? 0;
  // give the open-ended top zone a visible sliver, and pad above current price if it exceeds all finite bounds
  const rangeMax = Math.max(finiteMax * 1.08, price * 1.03, rangeMin + 1);
  const span = rangeMax - rangeMin || 1;

  const pricePct = Math.min(100, Math.max(0, ((price - rangeMin) / span) * 100));
  const currentZone = sorted.find((z) => price >= z.min && price < z.max);

  return (
    <div className="zone-gauge">
      <div className="zone-gauge-track">
        {sorted.map((z) => {
          const segMin = Math.max(z.min, rangeMin);
          const segMax = Number.isFinite(z.max) ? z.max : rangeMax;
          const widthPct = (Math.max(0, segMax - segMin) / span) * 100;
          return (
            <div
              key={z.id}
              className="zone-gauge-segment"
              style={{
                width: `${widthPct}%`,
                background: TONE_COLOR[z.tone] ?? "#888",
                opacity: z.id === currentZone?.id ? 1 : 0.45,
              }}
              title={`${z.label} (${z.tone})`}
            />
          );
        })}
        <div className="zone-gauge-marker" style={{ left: `${pricePct}%` }} />
      </div>
      <div className="zone-gauge-caption">
        {currentZone ? (
          <>
            <strong>{currentZone.label}</strong>
            <span className="zone-tone-tag" style={{ color: TONE_COLOR[currentZone.tone] }}>
              {currentZone.tone}
            </span>
          </>
        ) : (
          <span>구간 정보 없음 — 설정에서 기준선을 확인하세요</span>
        )}
      </div>
    </div>
  );
}
