import { useState } from "react";
import type { Asset } from "../types";

interface Props {
  asset: Asset;
  onSave: (price: number) => void;
}

export function ManualPricePanel({ asset, onSave }: Props) {
  const [draft, setDraft] = useState(asset.manualPrice != null ? String(asset.manualPrice) : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(draft);
    if (draft === "" || Number.isNaN(v) || v <= 0) return;
    onSave(v);
  }

  return (
    <div className="manual-price-card">
      <div className="entry-panel-header">
        <h2>{asset.name} 현재가</h2>
        {asset.manualPriceUpdatedAt && (
          <span className="streak-badge">
            {new Date(asset.manualPriceUpdatedAt).toLocaleString("ko-KR")} 입력
          </span>
        )}
      </div>
      <p className="section-sub">
        이 자산은 브라우저에서 바로 부를 수 있는 무료·무인증 시세 API가 없어 직접 입력합니다.
      </p>
      <form className="entry-form" onSubmit={handleSubmit}>
        <input
          type="number"
          step="any"
          placeholder={`현재가 (${asset.currency})`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit">저장</button>
      </form>
      {asset.manualPrice != null && (
        <div className="summary-price-row">
          <span className="summary-price">
            {asset.currency}
            {asset.manualPrice.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
