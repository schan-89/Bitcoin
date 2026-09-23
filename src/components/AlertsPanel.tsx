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
  return (
    <div className="entry-panel">
      <div className="entry-panel-header">
        <h2>기준선 알림</h2>
        {permission === "unsupported" ? (
          <span className="streak-badge">이 브라우저는 알림을 지원하지 않음</span>
        ) : permission === "granted" ? (
          <span className="streak-badge">알림 켜짐</span>
        ) : permission === "denied" ? (
          <span className="streak-badge">알림 차단됨 (브라우저 설정에서 허용 필요)</span>
        ) : (
          <button type="button" className="link-btn" onClick={onRequestPermission}>
            브라우저 알림 켜기
          </button>
        )}
      </div>
      <p className="section-sub">
        가격이 기준선(구간 경계) ±{PROXIMITY_THRESHOLD_PCT}% 이내로 접근하면 알림을 보냅니다. 앱이 열려있는 동안,
        가격을 갱신할 때(5분마다)마다 확인합니다.
      </p>

      {nearby.length > 0 ? (
        <ul className="nearby-list">
          {nearby.map((b) => (
            <li key={b.key}>
              <strong>{fmtUsd(b.boundaryPrice)}</strong> ({b.zoneLabel} 경계) — 거리 {b.distancePct.toFixed(2)}%
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-sub">현재 근접한 기준선이 없습니다.</p>
      )}

      {alertLog.length > 0 && (
        <>
          <h3 className="alert-log-title">알림 기록</h3>
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
        </>
      )}
    </div>
  );
}
