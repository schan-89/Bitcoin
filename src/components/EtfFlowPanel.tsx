import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { useState } from "react";
import { Bar } from "react-chartjs-2";
import { etfInflowStreak } from "../lib/realDemand";
import type { EtfFlowEntry } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  entries: EtfFlowEntry[];
  onAdd: (entry: EtfFlowEntry) => void;
  onDelete: (date: string) => void;
}

export function EtfFlowPanel({ entries, onAdd, onDelete }: Props) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const streak = etfInflowStreak(entries);
  const chartEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!date || Number.isNaN(value)) return;
    onAdd({ date, netFlowUsdM: value });
    setAmount("");
  }

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>ETF 자금 흐름</h2>
        <span className="streak-badge">
          {entries.length === 0 ? "데이터 없음" : `${streak}일 연속 순유입`}
        </span>
      </div>

      {chartEntries.length > 0 && (
        <div className="entry-chart">
          <Bar
            data={{
              labels: chartEntries.map((e) => e.date.slice(5)),
              datasets: [
                {
                  label: "일별 순유입/유출 (USD M)",
                  data: chartEntries.map((e) => e.netFlowUsdM),
                  backgroundColor: chartEntries.map((e) => (e.netFlowUsdM >= 0 ? "#2e8b57" : "#c0392b")),
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { ticks: { callback: (v) => `$${v}M` } } },
            }}
          />
        </div>
      )}

      <form className="entry-form" onSubmit={handleSubmit}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input
          type="number"
          step="any"
          placeholder="순유입 금액 (USD M, 유출은 음수)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <button type="submit">추가</button>
      </form>

      {sorted.length > 0 && (
        <table className="entry-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>순유입 (USD M)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.date}>
                <td>{e.date}</td>
                <td className={e.netFlowUsdM >= 0 ? "up" : "down"}>
                  {e.netFlowUsdM >= 0 ? "+" : ""}
                  {e.netFlowUsdM.toLocaleString()}
                </td>
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
