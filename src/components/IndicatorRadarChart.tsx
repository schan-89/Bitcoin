import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import type { IndicatorResult } from "../types";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function IndicatorRadarChart({ results }: { results: IndicatorResult[] }) {
  const data = {
    labels: results.map((r) => r.label),
    datasets: [
      {
        label: "A지표 점수",
        data: results.map((r) => r.score ?? 0),
        borderColor: "#f2a900",
        backgroundColor: "rgba(242,169,0,0.15)",
        pointBackgroundColor: results.map((r) =>
          r.score === null ? "#9ca3af" : r.score === 1 ? "#2e8b57" : r.score === -1 ? "#c0392b" : "#b8860b",
        ),
        pointRadius: 4,
      },
    ],
  };

  return (
    <div className="radar-chart">
      <Radar
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: -1,
              max: 1,
              ticks: { stepSize: 1, showLabelBackdrop: false },
              pointLabels: { font: { size: 10 } },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const r = results[ctx.dataIndex];
                  return `${r.label}: ${r.score === null ? "데이터 없음" : r.score === 1 ? "긍정" : r.score === -1 ? "경계" : "대기"}`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
