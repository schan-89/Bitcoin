import type { TradeEntry, TradePlan, TradeStats } from "../types";

export function computeTradeStats(plan: TradePlan, entries: TradeEntry[]): TradeStats {
  const totalTargetSellQty = plan.holdingsQty * (plan.targetSellRatioPct / 100);

  const sells = entries.filter((e) => e.side === "sell");
  const buys = entries.filter((e) => e.side === "buy");

  const cumulativeSoldQty = sells.reduce((sum, e) => sum + e.quantity, 0);
  const sellAmount = sells.reduce((sum, e) => sum + e.quantity * e.price, 0);
  const avgSellPrice = cumulativeSoldQty > 0 ? sellAmount / cumulativeSoldQty : null;

  const cumulativeBoughtQty = buys.reduce((sum, e) => sum + e.quantity, 0);
  const buyAmount = buys.reduce((sum, e) => sum + e.quantity * e.price, 0);
  const avgBuyPrice = cumulativeBoughtQty > 0 ? buyAmount / cumulativeBoughtQty : null;

  const remainingTargetQty = totalTargetSellQty - cumulativeSoldQty;
  const sellProgressPct =
    totalTargetSellQty > 0 ? Math.min(100, Math.max(0, (cumulativeSoldQty / totalTargetSellQty) * 100)) : 0;

  return {
    totalTargetSellQty,
    cumulativeSoldQty,
    remainingTargetQty,
    avgSellPrice,
    sellProgressPct,
    cumulativeBoughtQty,
    avgBuyPrice,
  };
}
