import { PROXIMITY_THRESHOLD_PCT } from "../lib/boundaryAlerts";
import type { AlertLogEntry, BoundaryProximity } from "../types";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface Props {
  permission: NotificationPermission | "unsupported";
  onRequestPermission: () => void;
  nearby: BoundaryProximity[];
  alertLog: AlertLogEntry[];
}

export function AlertsPanel({ permission, onRequestPermission, nearby, alertLog }: Props) {
  // 한 구간의 위쪽 경계와 다음 구간의 아래쪽 경계는 같은 가격이라 두 줄로 나오면 중복처럼 보인다.
  const mergedNearby = [...new Set(nearby.map((b) => b.boundaryPrice))].map((boundaryPrice) => {
    const same = nearby.filter((b) => b.boundaryPrice === boundaryPrice);
    return { boundaryPrice, distancePct: same[0].distancePct, labels: same.map((b) => b.zoneLabel) };
  });

  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>기준선 알림</h2>
        {permission === "unsupported" ? (
          <span className="streak-badge">이 브라우저는 알림을 지원하지 않음</span>
        ) : permission === "granted" ? (
          <span className="streak-badge">알림 켜짐</span>
        ) : permission === "denied" ? (
          <span className="streak-badge">알림 차단됨 · 브라우저 설정에서 허용</span>
        ) : (
          <button type="button" className="link-btn" onClick={onRequestPermission}>
            브라우저 알림 켜기
          </button>
        )}
      </div>
      <p className="section-sub">
        기준선 ±{PROXIMITY_THRESHOLD_PCT}% 이내로 다가오면 알림을 보냅니다. 앱을 열어 둔 동안 5분마다 확인합니다.
      </p>

      {mergedNearby.length > 0 ? (
        <ul className="nearby-list">
          {mergedNearby.map((b) => (
            <li key={b.boundaryPrice}>
              <strong>{fmtUsd(b.boundaryPrice)}</strong> · 현재가에서 {b.distancePct.toFixed(2)}% 거리
              <span className="nearby-labels">{b.labels.join(" · ")} 경계</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-sub">현재 근접한 기준선이 없습니다.</p>
      )}

      {alertLog.length > 0 && (
        <details className="fold">
          <summary>알림 기록 {alertLog.length}건</summary>
          <table className="entry-table">
            <thead>
              <tr>
                <th>시각</th>
                <th>기준선</th>
                <th>당시 가격</th>
              </tr>
            </thead>
            <tbody>
              {[...alertLog]
                .reverse()
                .slice(0, 20)
                .map((a) => (
                  <tr key={a.timestamp + a.zoneLabel}>
                    <td>{new Date(a.timestamp).toLocaleString("ko-KR")}</td>
                    <td>
                      {a.zoneLabel} ({fmtUsd(a.boundaryPrice)})
                    </td>
                    <td>{fmtUsd(a.price)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
