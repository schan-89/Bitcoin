import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import type { DailyScoreSnapshot } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

export function ScoreTrendChart({ snapshots }: { snapshots: DailyScoreSnapshot[] }) {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) {
    return <p className="section-sub">추세를 표시하려면 최소 이틀 이상의 기록이 필요합니다.</p>;
  }

  return (
    <div className="score-trend-chart">
      <Line
        data={{
          labels: sorted.map((s) => s.date.slice(5)),
          datasets: [
            {
              label: "A지표 총점",
              data: sorted.map((s) => s.total),
              borderColor: "#f2a900",
              backgroundColor: "rgba(242,169,0,0.1)",
              fill: true,
              pointRadius: 2,
              tension: 0.15,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { stepSize: 2 } } },
        }}
      />
    </div>
  );
}
