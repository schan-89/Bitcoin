import { useState } from "react";
import type { DerivativesEntry } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  entries: DerivativesEntry[];
  onAdd: (entry: DerivativesEntry) => void;
  onDelete: (date: string) => void;
}

function fmt(n: number | undefined, suffix: string): string {
  return n == null ? "—" : `${n.toLocaleString()}${suffix}`;
}

export function DerivativesPanel({ entries, onAdd, onDelete }: Props) {
  const [date, setDate] = useState(todayIso());
  const [liquidation, setLiquidation] = useState("");
  const [openInterest, setOpenInterest] = useState("");
  const [fundingRate, setFundingRate] = useState("");

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    const entry: DerivativesEntry = { date };
    if (liquidation !== "") entry.liquidationUsdM = Number(liquidation);
    if (openInterest !== "") entry.openInterestUsdM = Number(openInterest);
    if (fundingRate !== "") entry.fundingRatePct = Number(fundingRate);
    if (entry.liquidationUsdM == null && entry.openInterestUsdM == null && entry.fundingRatePct == null) return;
    onAdd(entry);
    setLiquidation("");
    setOpenInterest("");
    setFundingRate("");
  }

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>청산 · 미결제약정 · 펀딩비</h2>
      </div>

      <form className="entry-form deriv-form" onSubmit={handleSubmit}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input
          type="number"
          step="any"
          placeholder="청산액(USD M)"
          value={liquidation}
          onChange={(e) => setLiquidation(e.target.value)}
        />
        <input
          type="number"
          step="any"
          placeholder="미결제약정(USD M)"
          value={openInterest}
          onChange={(e) => setOpenInterest(e.target.value)}
        />
        <input
          type="number"
          step="any"
          placeholder="펀딩비(%/8h)"
          value={fundingRate}
          onChange={(e) => setFundingRate(e.target.value)}
        />
        <button type="submit">추가</button>
      </form>

      {sorted.length > 0 && (
        <table className="entry-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>청산</th>
              <th>미결제약정</th>
              <th>펀딩비</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.date}>
                <td>{e.date}</td>
                <td>{fmt(e.liquidationUsdM, "M")}</td>
                <td>{fmt(e.openInterestUsdM, "M")}</td>
                <td>{fmt(e.fundingRatePct, "%")}</td>
                <td>
                  <button type="button" className="remove-btn" onClick={() => onDelete(e.date)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
