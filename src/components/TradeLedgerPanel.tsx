import { useState } from "react";
import type { TradeEntry } from "../types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  entries: TradeEntry[];
  onAdd: (entry: Omit<TradeEntry, "id">) => void;
  onDelete: (id: string) => void;
}

export function TradeLedgerPanel({ entries, onAdd, onDelete }: Props) {
  const [date, setDate] = useState(todayIso());
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    const px = Number(price);
    if (!date || Number.isNaN(qty) || qty <= 0 || Number.isNaN(px) || px <= 0) return;
    onAdd({ date, side, quantity: qty, price: px });
    setQuantity("");
    setPrice("");
  }

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>체결 기록</h2>
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
          <option value="sell">매도</option>
          <option value="buy">매수</option>
        </select>
        <input
          type="number"
          step="any"
          placeholder="수량"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          type="number"
          step="any"
          placeholder="체결가(USD)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <button type="submit">추가</button>
      </form>

      {sorted.length > 0 && (
        <table className="entry-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>구분</th>
              <th>수량</th>
              <th>체결가</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td className={e.side === "sell" ? "down" : "up"}>{e.side === "sell" ? "매도" : "매수"}</td>
                <td>{e.quantity.toLocaleString()}</td>
                <td>${e.price.toLocaleString()}</td>
                <td>
                  <button type="button" className="remove-btn" onClick={() => onDelete(e.id)}>
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
