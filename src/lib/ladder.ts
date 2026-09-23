import type { LadderPlan, LadderStatus } from "../types";

/**
 * 라방식 분할매수 계획의 현재 상태를 계산한다.
 *
 * 예: "SPY 2X: 720 → 660 달러 / 매 10달러 마다 3%씩 (현재 4% / 총 25%)"
 *   → startPrice 720, endPrice 660, stepPrice 10, pctPerStep 3, totalPct 25
 *
 * 계획은 아래로 내려가며 사는 구조이므로, 가격이 startPrice 이하로 내려온 만큼
 * 단계가 발동한다. startPrice에 도달한 시점을 1단계로 본다.
 */
export function computeLadderStatus(plan: LadderPlan, price: number | null): LadderStatus {
  const span = plan.startPrice - plan.endPrice;
  // 계획이 잘못 입력된 경우(간격 0 등)에도 나눗셈이 터지지 않게 방어한다.
  const totalSteps = plan.stepPrice > 0 && span > 0 ? Math.floor(span / plan.stepPrice) + 1 : 0;

  if (price == null || totalSteps === 0) {
    return {
      triggeredSteps: 0,
      totalSteps,
      targetPct: 0,
      currentPct: plan.currentPct,
      gapPct: -plan.currentPct,
      nextTriggerPrice: totalSteps === 0 ? null : plan.startPrice,
      plannedTotalPct: totalSteps * plan.pctPerStep,
      state: "시작 전",
    };
  }

  let triggeredSteps: number;
  if (price > plan.startPrice) triggeredSteps = 0;
  else triggeredSteps = Math.min(totalSteps, Math.floor((plan.startPrice - price) / plan.stepPrice) + 1);

  // 계획상 최대 비중(totalPct)을 절대 넘지 않도록 자른다.
  const targetPct = Math.min(plan.totalPct, triggeredSteps * plan.pctPerStep);
  const nextTriggerPrice =
    triggeredSteps >= totalSteps ? null : plan.startPrice - triggeredSteps * plan.stepPrice;

  const state: LadderStatus["state"] =
    triggeredSteps === 0 ? "시작 전" : triggeredSteps >= totalSteps ? "계획 완료" : "진행 중";

  return {
    triggeredSteps,
    totalSteps,
    targetPct,
    currentPct: plan.currentPct,
    gapPct: targetPct - plan.currentPct,
    nextTriggerPrice,
    plannedTotalPct: totalSteps * plan.pctPerStep,
    state,
  };
}
