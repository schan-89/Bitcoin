import type { Zone } from "../types";

interface Props {
  price: number;
  change24h: number | null;
  ma50: number | null;
  ma200: number | null;
  crossState: "golden" | "dead" | "unknown";
  zone: Zone | undefined;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function SummaryCard({ price, change24h, ma50, ma200, crossState, zone }: Props) {
  const deltaVsMa50 = ma50 ? ((price - ma50) / ma50) * 100 : null;
  const deltaVsMa200 = ma200 ? ((price - ma200) / ma200) * 100 : null;

  return (
    <div className="summary-card">
      <div className="summary-price-row">
        <span className="summary-price">{fmtUsd(price)}</span>
        {change24h != null && (
          <span className={`summary-change ${change24h >= 0 ? "up" : "down"}`}>
            {fmtPct(change24h)} (24h)
          </span>
        )}
      </div>
      {zone && (
        <div className="summary-zone-line">
          지금 상태: <strong>{zone.label}</strong> <span className="tone">({zone.tone})</span>
        </div>
      )}
      <div className="summary-grid">
        <div className="summary-cell">
          <span className="label">현재가 vs 50일선</span>
          <span className={`value ${deltaVsMa50 != null && deltaVsMa50 >= 0 ? "up" : "down"}`}>
            {fmtPct(deltaVsMa50)}
          </span>
        </div>
        <div className="summary-cell">
          <span className="label">현재가 vs 200일선</span>
          <span className={`value ${deltaVsMa200 != null && deltaVsMa200 >= 0 ? "up" : "down"}`}>
            {fmtPct(deltaVsMa200)}
          </span>
        </div>
        <div className="summary-cell">
          <span className="label">골든/데드크로스</span>
          <span className={`value ${crossState}`}>
            {crossState === "golden" ? "골든크로스 상태" : crossState === "dead" ? "데드크로스 상태" : "판단 보류"}
          </span>
        </div>
      </div>
    </div>
  );
}
