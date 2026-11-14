interface Props {
  price: number;
  ma50: number | null;
  ma200: number | null;
  crossState: "golden" | "dead" | "unknown";
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

// 가격 자체는 상단 바에 이미 있으므로, 여기서는 이동평균 대비 위치만 보여준다.
export function SummaryCard({ price, ma50, ma200, crossState }: Props) {
  const deltaVsMa50 = ma50 ? ((price - ma50) / ma50) * 100 : null;
  const deltaVsMa200 = ma200 ? ((price - ma200) / ma200) * 100 : null;

  return (
    <dl className="ma-row">
      <div className="ma-cell">
        <dt>50일선 대비</dt>
        <dd className={deltaVsMa50 != null && deltaVsMa50 >= 0 ? "up" : "down"}>{fmtPct(deltaVsMa50)}</dd>
      </div>
      <div className="ma-cell">
        <dt>200일선 대비</dt>
        <dd className={deltaVsMa200 != null && deltaVsMa200 >= 0 ? "up" : "down"}>{fmtPct(deltaVsMa200)}</dd>
      </div>
      <div className="ma-cell">
        <dt>이평선 교차</dt>
        <dd className={crossState === "golden" ? "up" : crossState === "dead" ? "down" : ""}>
          {crossState === "golden" ? "골든크로스" : crossState === "dead" ? "데드크로스" : "판단 보류"}
        </dd>
      </div>
    </dl>
  );
}
