import { useEffect, useMemo, useRef, useState } from "react";
import { AIndicatorPanel } from "./components/AIndicatorPanel";
import { AIndicatorSummaryCard } from "./components/AIndicatorSummaryCard";
import { AlertsPanel } from "./components/AlertsPanel";
import { AssetSwitcher } from "./components/AssetSwitcher";
import { FinnhubPricePanel } from "./components/FinnhubPricePanel";
import { LadderPanel } from "./components/LadderPanel";
import { ManualPricePanel } from "./components/ManualPricePanel";
import { DerivativesPanel } from "./components/DerivativesPanel";
import { EtfFlowPanel } from "./components/EtfFlowPanel";
import { IndicatorHeatmap } from "./components/IndicatorHeatmap";
import { IndicatorRadarChart } from "./components/IndicatorRadarChart";
import { CandleChart } from "./components/CandleChart";
import { RealDemandCard } from "./components/RealDemandCard";
import { ScoreTrendChart } from "./components/ScoreTrendChart";
import { SettingsPanel } from "./components/SettingsPanel";
import { SummaryCard } from "./components/SummaryCard";
import { SynthesisCard } from "./components/SynthesisCard";
import { TradeLedgerPanel } from "./components/TradeLedgerPanel";
import { TradePlanPanel } from "./components/TradePlanPanel";
import { TradeProgressCard } from "./components/TradeProgressCard";
import { ZoneGauge } from "./components/ZoneGauge";
import { computeIndicators, summarizeIndicators } from "./lib/aIndicators";
import {
  BTC_ASSET_ID,
  loadActiveAssetId,
  loadAssets,
  newCustomAsset,
  saveActiveAssetId,
  saveAssets,
} from "./lib/assets";
import { fetchCandles, fetchCurrentPrice, fetchDailyCandles } from "./lib/binance";
import { fetchFinnhubQuote, loadFinnhubApiKey, saveFinnhubApiKey } from "./lib/finnhub";
import {
  loadEntries,
  loadObject,
  makeId,
  removeByDate,
  removeById,
  saveEntries,
  saveObject,
  upsertByDate,
} from "./lib/entryStore";
import { findNearbyBoundaries } from "./lib/boundaryAlerts";
import {
  buildIndicatorSeries,
  buildMinuteIndicatorSeries,
  buildWeeklyIndicatorSeries,
  findCrosses,
  latestCrossState,
} from "./lib/indicators";
import { getNotificationPermission, requestNotificationPermission, sendLocalNotification } from "./lib/notifications";
import { evaluateRealDemand } from "./lib/realDemand";
import { synthesize } from "./lib/synthesis";
import { computeTradeStats } from "./lib/tradeLedger";
import { getZone, loadZones, saveZones } from "./lib/zones";
import type {
  AlertLogEntry,
  Asset,
  LadderPlan,
  DailyScoreSnapshot,
  DerivativesEntry,
  EtfFlowEntry,
  IndicatorScore,
  IndicatorSeries,
  ManualIndicatorMap,
  TradeEntry,
  TradePlan,
  TradePlanChange,
  Zone,
} from "./types";

const ETF_STORAGE_KEY = "btc-app-etf-flow-v1";
const DERIV_STORAGE_KEY = "btc-app-derivatives-v1";
const TRADE_PLAN_KEY = "btc-app-trade-plan-v1";
const TRADE_PLAN_HISTORY_KEY = "btc-app-trade-plan-history-v1";
const TRADE_ENTRIES_KEY = "btc-app-trade-entries-v1";
const DEFAULT_TRADE_PLAN: TradePlan = { holdingsQty: 0, targetSellRatioPct: 0 };
const MANUAL_INDICATORS_KEY = "btc-app-manual-indicators-v1";
const EWY_NOTE_KEY = "btc-app-ewy-note-v1";
const SCORE_HISTORY_KEY = "btc-app-score-history-v1";
const ALERT_LOG_KEY = "btc-app-alert-log-v1";

function fmtHeaderPrice(n: number, currency: string): string {
  return `${currency}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const INTERVAL_OPTIONS = [
  { label: "1분", value: "1m" },
  { label: "1일", value: "1d" },
  { label: "1주", value: "1w" },
];

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(() => loadAssets());
  const [activeAssetId, setActiveAssetId] = useState<string>(() => loadActiveAssetId());
  const activeAsset = assets.find((a) => a.id === activeAssetId) ?? assets[0];
  const isBtc = activeAsset.id === BTC_ASSET_ID;
  const sourceKind = activeAsset.source.kind;
  const binanceSymbol = sourceKind === "binance" ? activeAsset.source.symbol : null;
  const finnhubSymbol = sourceKind === "finnhub" ? activeAsset.source.symbol : null;
  // binance는 캔들 히스토리까지 주지만 finnhub 무료 티어는 현재가만 준다 — 캔들차트는 binance 전용.
  const hasCandles = sourceKind === "binance";

  const [zones, setZones] = useState<Zone[]>(() => loadZones(loadActiveAssetId()));
  const [series, setSeries] = useState<IndicatorSeries | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finnhubApiKey, setFinnhubApiKey] = useState<string>(() => loadFinnhubApiKey());
  const [chartInterval, setChartInterval] = useState("1d");
  const [showMa, setShowMa] = useState(true);
  const [showBmsb, setShowBmsb] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [showCrossMarkers, setShowCrossMarkers] = useState(true);
  const [weeklySeries, setWeeklySeries] = useState<IndicatorSeries | null>(null);
  const [minuteSeries, setMinuteSeries] = useState<IndicatorSeries | null>(null);
  const [etfEntries, setEtfEntries] = useState<EtfFlowEntry[]>(() => loadEntries(ETF_STORAGE_KEY));
  const [derivEntries, setDerivEntries] = useState<DerivativesEntry[]>(() => loadEntries(DERIV_STORAGE_KEY));
  const [tradePlan, setTradePlan] = useState<TradePlan>(() => loadObject(TRADE_PLAN_KEY, DEFAULT_TRADE_PLAN));
  const [tradePlanHistory, setTradePlanHistory] = useState<TradePlanChange[]>(() =>
    loadEntries(TRADE_PLAN_HISTORY_KEY),
  );
  const [tradeEntries, setTradeEntries] = useState<TradeEntry[]>(() => loadEntries(TRADE_ENTRIES_KEY));
  const [manualIndicators, setManualIndicators] = useState<ManualIndicatorMap>(() =>
    loadObject(MANUAL_INDICATORS_KEY, {}),
  );
  const [ewyNote, setEwyNote] = useState<string>(() => loadObject(EWY_NOTE_KEY, ""));
  const [scoreHistory, setScoreHistory] = useState<DailyScoreSnapshot[]>(() => loadEntries(SCORE_HISTORY_KEY));
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission());
  const [alertLog, setAlertLog] = useState<AlertLogEntry[]>(() => loadEntries(ALERT_LOG_KEY));
  const previouslyNearKeys = useRef<Set<string>>(new Set());
  // 차트는 CSS 변수를 못 읽으므로 테마를 직접 알려줘야 한다.
  const [isDark, setIsDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true,
  );

  // 자산을 바꾸면 그 자산의 기준선 세트로 갈아끼운다.
  useEffect(() => {
    setZones(loadZones(activeAssetId));
    saveActiveAssetId(activeAssetId);
  }, [activeAssetId]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // 수동 입력 자산은 부를 API가 없으므로 이전 자산의 시세가 남지 않도록 비우고 끝낸다.
    if (binanceSymbol === null && finnhubSymbol === null) {
      setSeries(null);
      setLivePrice(null);
      setChange24h(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadBinance(symbol: string) {
      setLoading(true);
      setError(null);
      try {
        const [candles, current] = await Promise.all([
          fetchDailyCandles(symbol, 1000),
          fetchCurrentPrice(symbol),
        ]);
        if (cancelled) return;
        setSeries(buildIndicatorSeries(candles));
        setLivePrice(current.price);
        setChange24h(current.change24h);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Finnhub 무료 티어는 현재가만 주고 과거 캔들은 유료 전용이라 series는 비워둔다.
    async function loadFinnhub(symbol: string) {
      setSeries(null);
      setLoading(true);
      setError(null);
      try {
        const current = await fetchFinnhubQuote(symbol);
        if (cancelled) return;
        setLivePrice(current.price);
        setChange24h(current.change24h);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (binanceSymbol !== null) {
      loadBinance(binanceSymbol);
      const interval = setInterval(() => loadBinance(binanceSymbol), 5 * 60 * 1000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    loadFinnhub(finnhubSymbol as string);
    const interval = setInterval(() => loadFinnhub(finnhubSymbol as string), 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [binanceSymbol, finnhubSymbol, finnhubApiKey]);

  // 차트 봉 단위 — "1일"이면 위 effect가 이미 받아온 series를 그대로 쓴다. "1주"/"1분"은
  // 각자 그 봉 단위로 지표를 다시 계산해서 쓴다("50주"·"200주"·"50분"·"200분"이 전부 그 봉
  // 네이티브 계산이라 일봉 기반 근사보다 정확하다). 불마켓밴드는 1주에만 있다 — 20/21분
  // SMA·EMA로 부를 근거가 없어서 1분에는 빼뒀다 (indicators.ts 참고).
  useEffect(() => {
    if (binanceSymbol === null || chartInterval === "1d") {
      setWeeklySeries(null);
      setMinuteSeries(null);
      return;
    }

    let cancelled = false;
    async function load(symbol: string) {
      try {
        const candles = await fetchCandles(symbol, chartInterval, 1000);
        if (cancelled) return;
        if (chartInterval === "1w") {
          setWeeklySeries(buildWeeklyIndicatorSeries(candles));
          setMinuteSeries(null);
        } else {
          setMinuteSeries(buildMinuteIndicatorSeries(candles));
          setWeeklySeries(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "차트 데이터를 불러오지 못했습니다");
      }
    }

    load(binanceSymbol);
    const pollMs = chartInterval === "1m" ? 30 * 1000 : 5 * 60 * 1000;
    const pollId = setInterval(() => load(binanceSymbol), pollMs);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [binanceSymbol, chartInterval]);

  // 항상 일봉 기준 — 요약 카드·A지표 골든/데드크로스 판정이 여기 물려 있어서, 차트 봉 단위를
  // 바꾼다고 이 판정까지 같이 흔들리면 안 된다.
  const crosses = useMemo(() => (series ? findCrosses(series) : []), [series]);
  const crossState = useMemo(() => latestCrossState(crosses), [crosses]);
  // 캔들차트에 그릴 크로스 마커만 현재 봉 단위를 따라간다.
  const chartCrosses = useMemo(() => {
    const activeSeries =
      chartInterval === "1d" ? series : chartInterval === "1w" ? weeklySeries : minuteSeries;
    return activeSeries ? findCrosses(activeSeries) : [];
  }, [series, weeklySeries, minuteSeries, chartInterval]);

  const price =
    binanceSymbol !== null
      ? livePrice ?? (series ? series.close[series.close.length - 1] : null)
      : finnhubSymbol !== null
        ? livePrice
        : activeAsset.manualPrice ?? null;
  const ma50 = series ? series.ma50[series.ma50.length - 1] : null;
  const ma200 = series ? series.ma200[series.ma200.length - 1] : null;
  const ma50w = series ? series.ma50w[series.ma50w.length - 1] : null;
  const bmsbSma = series ? series.bmsbSma[series.bmsbSma.length - 1] : null;
  const bmsbEma = series ? series.bmsbEma[series.bmsbEma.length - 1] : null;
  const currentZone = price != null ? getZone(zones, price) : undefined;

  const realDemand = useMemo(() => evaluateRealDemand(etfEntries, derivEntries), [etfEntries, derivEntries]);
  const tradeStats = useMemo(() => computeTradeStats(tradePlan, tradeEntries), [tradePlan, tradeEntries]);

  const indicatorResults = useMemo(
    () =>
      computeIndicators({
        price,
        ma50,
        ma200,
        ma50w,
        bmsbSma,
        bmsbEma,
        crossState,
        etfEntries,
        derivEntries,
        manual: manualIndicators,
      }),
    [price, ma50, ma200, ma50w, bmsbSma, bmsbEma, crossState, etfEntries, derivEntries, manualIndicators],
  );
  const indicatorTotals = useMemo(() => summarizeIndicators(indicatorResults), [indicatorResults]);

  const synthesis = useMemo(
    () =>
      synthesize({
        zone: currentZone,
        zones,
        price,
        aScoreTotal: indicatorTotals.total,
        aScoreScored: indicatorTotals.scored,
        realDemand,
      }),
    [currentZone, zones, price, indicatorTotals, realDemand],
  );

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setScoreHistory((prev) => {
      const existing = prev.find((s) => s.date === today);
      if (existing && existing.total === indicatorTotals.total) return prev;
      const next = upsertByDate(prev, { date: today, total: indicatorTotals.total });
      saveEntries(SCORE_HISTORY_KEY, next);
      return next;
    });
  }, [indicatorTotals.total]);

  const nearbyBoundaries = useMemo(() => (price != null ? findNearbyBoundaries(zones, price) : []), [zones, price]);

  useEffect(() => {
    if (price == null) return;
    const currentKeys = new Set(nearbyBoundaries.map((b) => b.key));
    const newlyEntered = nearbyBoundaries.filter((b) => !previouslyNearKeys.current.has(b.key));
    previouslyNearKeys.current = currentKeys;
    if (newlyEntered.length === 0) return;

    setAlertLog((prev) => {
      const timestamp = new Date().toISOString();
      const entries: AlertLogEntry[] = newlyEntered.map((b) => ({
        timestamp,
        zoneLabel: b.zoneLabel,
        boundaryPrice: b.boundaryPrice,
        price,
      }));
      const next = [...prev, ...entries];
      saveEntries(ALERT_LOG_KEY, next);
      return next;
    });

    for (const b of newlyEntered) {
      sendLocalNotification(
        "기준선 접근 알림",
        `가격이 '${b.zoneLabel}' 경계(${b.boundaryPrice.toLocaleString()}달러)에서 ${b.distancePct.toFixed(1)}% 이내로 접근했습니다.`,
      );
    }
  }, [nearbyBoundaries, price]);

  function handleSaveZones(next: Zone[]) {
    setZones(next);
    saveZones(activeAssetId, next);
  }

  function updateAsset(id: string, patch: Partial<Asset>) {
    setAssets((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      saveAssets(next);
      return next;
    });
  }

  function handleAddAsset(asset: Asset) {
    setAssets((prev) => {
      if (prev.some((a) => a.id === asset.id)) return prev;
      const next = [...prev, asset];
      saveAssets(next);
      return next;
    });
    setActiveAssetId(asset.id);
  }

  function handleRemoveAsset(id: string) {
    if (id === BTC_ASSET_ID) return; // BTC 전용 분석 패널들이 매달려 있어 삭제 불가
    setAssets((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAssets(next);
      return next;
    });
    setActiveAssetId((cur) => (cur === id ? BTC_ASSET_ID : cur));
  }

  function handleSaveManualPrice(price: number) {
    updateAsset(activeAssetId, { manualPrice: price, manualPriceUpdatedAt: new Date().toISOString() });
  }

  function handleSaveFinnhubApiKey(key: string) {
    saveFinnhubApiKey(key);
    setFinnhubApiKey(key.trim());
  }

  function handleSaveLadder(plan: LadderPlan) {
    updateAsset(activeAssetId, { ladder: plan });
  }

  function handleAddEtfEntry(entry: EtfFlowEntry) {
    setEtfEntries((prev) => {
      const next = upsertByDate(prev, entry);
      saveEntries(ETF_STORAGE_KEY, next);
      return next;
    });
  }

  function handleDeleteEtfEntry(date: string) {
    setEtfEntries((prev) => {
      const next = removeByDate(prev, date);
      saveEntries(ETF_STORAGE_KEY, next);
      return next;
    });
  }

  function handleAddDerivEntry(entry: DerivativesEntry) {
    setDerivEntries((prev) => {
      const next = upsertByDate(prev, entry);
      saveEntries(DERIV_STORAGE_KEY, next);
      return next;
    });
  }

  function handleDeleteDerivEntry(date: string) {
    setDerivEntries((prev) => {
      const next = removeByDate(prev, date);
      saveEntries(DERIV_STORAGE_KEY, next);
      return next;
    });
  }

  function handleSaveTradePlan(next: TradePlan) {
    const timestamp = new Date().toISOString();
    const changes: TradePlanChange[] = [];
    if (next.holdingsQty !== tradePlan.holdingsQty) {
      changes.push({ timestamp, field: "holdingsQty", oldValue: tradePlan.holdingsQty, newValue: next.holdingsQty });
    }
    if (next.targetSellRatioPct !== tradePlan.targetSellRatioPct) {
      changes.push({
        timestamp,
        field: "targetSellRatioPct",
        oldValue: tradePlan.targetSellRatioPct,
        newValue: next.targetSellRatioPct,
      });
    }
    setTradePlan(next);
    saveObject(TRADE_PLAN_KEY, next);
    if (changes.length > 0) {
      setTradePlanHistory((prev) => {
        const nextHistory = [...prev, ...changes];
        saveEntries(TRADE_PLAN_HISTORY_KEY, nextHistory);
        return nextHistory;
      });
    }
  }

  function handleAddTradeEntry(entry: Omit<TradeEntry, "id">) {
    setTradeEntries((prev) => {
      const next = [...prev, { ...entry, id: makeId() }];
      saveEntries(TRADE_ENTRIES_KEY, next);
      return next;
    });
  }

  function handleDeleteTradeEntry(id: string) {
    setTradeEntries((prev) => {
      const next = removeById(prev, id);
      saveEntries(TRADE_ENTRIES_KEY, next);
      return next;
    });
  }

  function handleSetTriState(id: string, score: IndicatorScore) {
    setManualIndicators((prev) => {
      // Keep any rawValue already entered — 실현가격/밸런스가격은 판정과 별개로
      // 차트에 그릴 가격을 함께 들고 있으므로 여기서 지우면 차트 선이 사라진다.
      const next = { ...prev, [id]: { ...prev[id], score, updatedAt: new Date().toISOString() } };
      saveObject(MANUAL_INDICATORS_KEY, next);
      return next;
    });
  }

  function handleSetNumeric(id: string, rawValue: number) {
    setManualIndicators((prev) => {
      const existing = prev[id];
      const score = existing?.score ?? 0;
      const next = { ...prev, [id]: { score, rawValue, updatedAt: new Date().toISOString() } };
      saveObject(MANUAL_INDICATORS_KEY, next);
      return next;
    });
  }

  function handleSetEwyNote(note: string) {
    setEwyNote(note);
    saveObject(EWY_NOTE_KEY, note);
  }

  async function handleRequestNotificationPermission() {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <h1>가늠자</h1>
          {price != null ? (
            <span className="header-price">
              {fmtHeaderPrice(price, activeAsset.currency)}
              {change24h != null && (
                <span className={`header-price-change ${change24h >= 0 ? "up" : "down"}`}>
                  {change24h >= 0 ? "+" : ""}
                  {change24h.toFixed(2)}%
                </span>
              )}
            </span>
          ) : (
            loading && <span className="header-price loading">현재가 불러오는 중…</span>
          )}
        </div>
        <button type="button" className="settings-btn" onClick={() => setSettingsOpen(true)}>
          설정
        </button>
      </header>

      <AssetSwitcher
        assets={assets}
        activeId={activeAssetId}
        onSelect={setActiveAssetId}
        onAddPreset={handleAddAsset}
        onAddCustom={(name, currency) => handleAddAsset(newCustomAsset(name, currency))}
        onRemove={handleRemoveAsset}
      />

      {isBtc && (
        <SynthesisCard
          result={synthesis}
          aScoreTotal={indicatorTotals.total}
          aScoreScored={indicatorTotals.scored}
          realDemandVerdict={realDemand.verdict}
        />
      )}

      {sourceKind === "manual" && (
        <ManualPricePanel key={activeAsset.id} asset={activeAsset} onSave={handleSaveManualPrice} />
      )}

      {sourceKind === "finnhub" && (
        <FinnhubPricePanel
          key={activeAsset.id}
          asset={activeAsset}
          price={price}
          change24h={change24h}
          hasApiKey={finnhubApiKey !== ""}
        />
      )}

      {loading && !series && sourceKind !== "manual" && <div className="status-msg">불러오는 중…</div>}
      {error && <div className="status-msg error">오류: {error}</div>}

      {!hasCandles && price != null && zones.length > 0 && (
        <section className="section">
          <h2>구간 게이지</h2>
          <ZoneGauge zones={zones} price={price} />
        </section>
      )}

      {!hasCandles && zones.length === 0 && (
        <section className="section">
          <h2>구간 게이지</h2>
          <p className="section-sub">
            이 자산의 기준선이 아직 없습니다. 우측 상단 "설정"에서 가격 구간을 입력하세요.
          </p>
        </section>
      )}

      {series && price != null && (
        <>
          <SummaryCard
            price={price}
            change24h={change24h}
            ma50={ma50}
            ma200={ma200}
            crossState={crossState}
            zone={currentZone}
          />

          <section className="section">
            <h2>구간 게이지</h2>
            <ZoneGauge zones={zones} price={price} />
          </section>

          <section className="section">
            <AlertsPanel
              permission={notificationPermission}
              onRequestPermission={handleRequestNotificationPermission}
              nearby={nearbyBoundaries}
              alertLog={alertLog}
            />
          </section>

          <section className="section">
            <div className="section-header-row">
              <h2>
                가격 차트{chartInterval === "1m" ? " (캔들 + 이평선 + RSI)" : " (캔들 + 이평선 + 불마켓밴드 + RSI)"}
              </h2>
              <div className="range-buttons">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={chartInterval === opt.value ? "active" : ""}
                    onClick={() => setChartInterval(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="range-buttons overlay-toggles">
              <button type="button" className={showMa ? "active" : ""} onClick={() => setShowMa((v) => !v)}>
                이평선
              </button>
              <button type="button" className={showBmsb ? "active" : ""} onClick={() => setShowBmsb((v) => !v)}>
                불마켓밴드
              </button>
              <button type="button" className={showRsi ? "active" : ""} onClick={() => setShowRsi((v) => !v)}>
                RSI
              </button>
              <button
                type="button"
                className={showCrossMarkers ? "active" : ""}
                onClick={() => setShowCrossMarkers((v) => !v)}
              >
                크로스마커
              </button>
            </div>
            {chartInterval === "1m" && (
              <p className="section-sub">
                불마켓밴드는 20/21분 SMA·EMA로 부를 근거가 없어 1분 봉에는 표시하지 않습니다. 화면을
                드래그하거나 두 손가락으로 확대·축소해 원하는 구간을 보세요.
              </p>
            )}
            {chartInterval === "1w" && weeklySeries == null && (
              <p className="status-msg">주봉 데이터 불러오는 중…</p>
            )}
            {chartInterval === "1m" && minuteSeries == null && (
              <p className="status-msg">분봉 데이터 불러오는 중…</p>
            )}
            <CandleChart
              series={series}
              weeklySeries={weeklySeries}
              minuteSeries={minuteSeries}
              interval={chartInterval}
              crosses={chartCrosses}
              showMa={showMa}
              showBmsb={showBmsb}
              showRsi={showRsi}
              showCrossMarkers={showCrossMarkers}
              realizedPrice={manualIndicators.realizedPrice?.rawValue}
              balancedPrice={manualIndicators.balancedPrice?.rawValue}
              isDark={isDark}
            />
          </section>
        </>
      )}

      <section className="section">
        <LadderPanel key={activeAsset.id} asset={activeAsset} price={price} onSave={handleSaveLadder} />
      </section>

      {isBtc && <RealDemandCard result={realDemand} />}

      {isBtc && (
      <section className="section">
        <h2>반자동 데이터 입력</h2>
        <p className="section-sub">
          ETF 자금 흐름과 청산·미결제약정·펀딩비를 매일 입력하면, 위 실수요 판정에 자동으로 반영됩니다.
        </p>
        <EtfFlowPanel entries={etfEntries} onAdd={handleAddEtfEntry} onDelete={handleDeleteEtfEntry} />
        <DerivativesPanel entries={derivEntries} onAdd={handleAddDerivEntry} onDelete={handleDeleteDerivEntry} />
      </section>
      )}

      {isBtc && <AIndicatorSummaryCard totals={indicatorTotals} />}

      {isBtc && (
      <section className="section">
        <h2>A지표 종합 시각화</h2>
        <div className="ai-viz-grid">
          <div>
            <h3>레이더 차트 — 지금 이 순간</h3>
            <IndicatorRadarChart results={indicatorResults} />
          </div>
          <div>
            <h3>신호등 히트맵 — 빠르게 스캔</h3>
            <IndicatorHeatmap results={indicatorResults} />
          </div>
        </div>
        <h3>종합 점수 추세</h3>
        <ScoreTrendChart snapshots={scoreHistory} />
      </section>
      )}

      {isBtc && (
      <section className="section">
        <AIndicatorPanel
          results={indicatorResults}
          manual={manualIndicators}
          onSetTriState={handleSetTriState}
          onSetNumeric={handleSetNumeric}
          ewyNote={ewyNote}
          onSetEwyNote={handleSetEwyNote}
        />
      </section>
      )}

      {isBtc && <TradeProgressCard stats={tradeStats} />}

      {isBtc && (
      <section className="section">
        <h2>매매 장부</h2>
        <TradePlanPanel plan={tradePlan} history={tradePlanHistory} onSave={handleSaveTradePlan} />
        <TradeLedgerPanel entries={tradeEntries} onAdd={handleAddTradeEntry} onDelete={handleDeleteTradeEntry} />
      </section>
      )}

      {!isBtc && (
        <p className="section-sub" style={{ textAlign: "center" }}>
          A지표 · 실수요 판정 · 매매 장부는 비트코인 분석 프레임이라 BTC 탭에서만 표시됩니다.
        </p>
      )}

      <p className="disclaimer">
        이 대시보드는 예측을 제공하지 않습니다. 미리 정한 기준선과 조건 대비 현재 상태만 계산해 보여주며,
        최종 판단은 사용자의 몫입니다.
      </p>

      {settingsOpen && (
        <SettingsPanel
          zones={zones}
          onSave={handleSaveZones}
          onClose={() => setSettingsOpen(false)}
          finnhubApiKey={finnhubApiKey}
          onSaveFinnhubApiKey={handleSaveFinnhubApiKey}
        />
      )}
    </div>
  );
}
