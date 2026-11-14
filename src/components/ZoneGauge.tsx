import type { Zone } from "../types";

// 막대 색은 톤마다 고정. 색만으로 구분하지 않도록 아래 범례에 톤 이름을 같이 적는다.
const TONE_COLOR: Record<string, string> = {
  위험: "#c0392b",
  경계: "#e0a800",
  관망: "#7c8a96",
  긍정: "#2e8b57",
  과열주의: "#c0782b",
};

// 톤 이름 칩: 글자-배경 대비가 모두 4.5:1 이상이 되도록 막대 색과 별도로 정한 값.
const TONE_PILL: Record<string, { bg: string; fg: string }> = {
  위험: { bg: "#b03225", fg: "#ffffff" },
  경계: { bg: "#e0a800", fg: "#1a1200" },
  관망: { bg: "#5f6d79", fg: "#ffffff" },
  긍정: { bg: "#23714a", fg: "#ffffff" },
  과열주의: { bg: "#a35a12", fg: "#ffffff" },
};

// 경계 눈금 라벨이 이 간격(%)보다 가까우면 뒤쪽 것을 생략해 겹침을 막는다.
const MIN_TICK_GAP_PCT = 12;

function fmtCompact(n: number, currency: string): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `${currency}${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return `${currency}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

interface Props {
  zones: Zone[];
  price: number;
  currency?: string;
}

export function ZoneGauge({ zones, price, currency = "$" }: Props) {
  const sorted = [...zones].sort((a, b) => a.min - b.min);
  const boundaries = sorted.slice(1).map((z) => z.min);

  // 전체 범위(0 ~ 최고 구간)를 다 그리면 지금 가격 주변이 한 줄로 뭉개진다.
  // 현재가 아래·위로 기준선을 두 개씩만 포함하는 창을 잡아 "바로 다음 확인 지점"이 크게 보이게 한다.
  const below = boundaries.filter((b) => b <= price);
  const above = boundaries.filter((b) => b > price);
  const floor = sorted[0]?.min ?? 0;
  const lo = Math.max(
    floor,
    below.length >= 2 ? below[below.length - 2] : below.length === 1 ? below[0] * 0.85 : price * 0.85,
  );
  const hi = Math.max(
    above.length >= 2 ? above[1] : above.length === 1 ? above[0] * 1.12 : price * 1.12,
    price * 1.03,
    lo + 1,
  );
  const span = hi - lo || 1;

  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));
  const pricePct = pct(price);
  const currentZone = sorted.find((z) => price >= z.min && price < z.max);

  // 눈금 라벨은 현재가에 가까운 것부터 채우고, 이미 놓인 라벨과 너무 가까우면 건너뛴다.
  const inWindow = boundaries.filter((b) => b > lo && b < hi);
  const byDistance = [...inWindow].sort((a, b) => Math.abs(a - price) - Math.abs(b - price));
  const kept: { value: number; left: number }[] = [];
  for (const value of byDistance) {
    const left = pct(value);
    if (kept.every((k) => Math.abs(k.left - left) >= MIN_TICK_GAP_PCT)) kept.push({ value, left });
  }
  const ticks = kept.sort((a, b) => a.left - b.left);

  // 말풍선이 양끝에서 잘리지 않게 위치만 안쪽으로 당기고, 꼬리(▼)는 실제 위치를 가리킨다.
  const bubbleLeft = Math.min(88, Math.max(12, pricePct));

  return (
    <div className="gauge">
      <div className="gauge-pointer" style={{ left: `${bubbleLeft}%` }}>
        <span className="gauge-bubble">{fmtCompact(price, currency)}</span>
      </div>
      <div className="gauge-track">
        {sorted.map((z) => {
          const segMin = Math.max(z.min, lo);
          const segMax = Math.min(Number.isFinite(z.max) ? z.max : hi, hi);
          const widthPct = (Math.max(0, segMax - segMin) / span) * 100;
          if (widthPct <= 0) return null;
          return (
            <div
              key={z.id}
              className="gauge-segment"
              style={{
                width: `${widthPct}%`,
                background: TONE_COLOR[z.tone] ?? "#888",
                opacity: z.id === currentZone?.id ? 1 : 0.35,
              }}
              title={`${z.label} (${z.tone})`}
            />
          );
        })}
        <div className="gauge-marker" style={{ left: `${pricePct}%` }} />
      </div>
      <div className="gauge-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.value} style={{ left: `${t.left}%` }}>
            {fmtCompact(t.value, currency)}
          </span>
        ))}
      </div>
      <div className="gauge-caption">
        {currentZone ? (
          <>
            <strong>{currentZone.label}</strong>
            <span
              className="gauge-tone"
              style={{
                background: TONE_PILL[currentZone.tone]?.bg ?? "#5f6d79",
                color: TONE_PILL[currentZone.tone]?.fg ?? "#ffffff",
              }}
            >
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
