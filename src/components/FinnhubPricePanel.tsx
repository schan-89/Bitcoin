import type { Asset } from "../types";

interface Props {
  asset: Asset;
  price: number | null;
  change24h: number | null;
  hasApiKey: boolean;
}

export function FinnhubPricePanel({ asset, price, change24h, hasApiKey }: Props) {
  return (
    <div className="manual-price-card">
      <div className="entry-panel-header">
        <h2>{asset.name} 현재가</h2>
        <span className="streak-badge">Finnhub 자동 조회</span>
      </div>
      {!hasApiKey && (
        <p className="section-sub">
          Finnhub API 키가 설정되지 않았습니다. 우측 상단 "설정"에서 무료 키를 입력하면 1분마다 자동으로
          조회됩니다.
        </p>
      )}
      {hasApiKey && price != null && (
        <div className="summary-price-row">
          <span className="summary-price">
            {asset.currency}
            {price.toLocaleString()}
          </span>
          {change24h != null && (
            <span className={`summary-change ${change24h >= 0 ? "up" : "down"}`}>
              {change24h >= 0 ? "+" : ""}
              {change24h.toFixed(2)}% (당일)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
