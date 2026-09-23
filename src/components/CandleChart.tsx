import {
  CandlestickSeries,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { CrossEvent, IndicatorSeries } from "../types";
import { BandSeries, type BandData } from "./bandSeries";

const COLORS = {
  up: "#26a69a",
  down: "#ef5350",
  ma50: "#3b6fd4",
  ma200: "#8b5cf6",
  ma50w: "#f2a900",
  bmsb: "#8a6d3b",
  realized: "#2e8b57",
  balanced: "#c0392b",
  rsi: "#b388ff",
};

function toTime(date: string): UTCTimestamp {
  return (Date.parse(date) / 1000) as UTCTimestamp;
}

/** Drops the leading nulls so a series starts where it actually has values. */
function lineData(dates: string[], values: (number | null)[]): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    if (v == null) continue;
    out.push({ time: toTime(dates[i]), value: v });
  }
  return out;
}

function flatLine(dates: string[], value: number): LineData<Time>[] {
  return dates.map((d) => ({ time: toTime(d), value }));
}

const INTERVAL_LABEL: Record<string, string> = { "1d": "일", "1w": "주", "1m": "분" };

interface Props {
  /** 일봉 지표 시리즈 — interval="1d"일 때 쓴다. */
  series: IndicatorSeries;
  /** 주봉 지표 시리즈 — interval="1w"일 때 쓴다. 아직 안 받아왔으면 null. */
  weeklySeries: IndicatorSeries | null;
  /** 분봉 지표 시리즈 — interval="1m"일 때 쓴다. 불마켓밴드는 근거가 없어서 빠져 있다
   *  (buildMinuteIndicatorSeries 참고). 아직 안 받아왔으면 null. */
  minuteSeries: IndicatorSeries | null;
  interval: string;
  crosses: CrossEvent[];
  /** 오버레이 켜기/끄기 — 전부 기본 true. */
  showMa: boolean;
  showBmsb: boolean;
  showRsi: boolean;
  showCrossMarkers: boolean;
  realizedPrice?: number;
  balancedPrice?: number;
  isDark: boolean;
}

export function CandleChart({
  series,
  weeklySeries,
  minuteSeries,
  interval,
  crosses,
  showMa,
  showBmsb,
  showRsi,
  showCrossMarkers,
  realizedPrice,
  balancedPrice,
  isDark,
}: Props) {
  const activeSeries =
    interval === "1d" ? series : interval === "1w" ? weeklySeries : interval === "1m" ? minuteSeries : null;
  const showIndicators = activeSeries !== null;
  const intervalLabel = INTERVAL_LABEL[interval] ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Build the chart once, then feed it data in a separate effect so changing the
  // range or an overlay value doesn't tear down and rebuild the whole chart.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#9ca3af" : "#4a4650",
        attributionLogo: false,
        panes: { separatorColor: isDark ? "#2e303a" : "#e5e4e7" },
      },
      grid: {
        vertLines: { color: isDark ? "#23252e" : "#eeeef0" },
        horzLines: { color: isDark ? "#23252e" : "#eeeef0" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? "#2e303a" : "#e5e4e7" },
      timeScale: { borderColor: isDark ? "#2e303a" : "#e5e4e7", timeVisible: true },
      autoSize: true,
    });
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [isDark]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // The chart-creation effect above owns this instance and nulls the ref when it
    // tears the chart down. Its cleanup runs *before* this one, so cleanup here must
    // confirm the chart it built against is still the live one — calling removeSeries
    // on a destroyed chart throws.
    const isStillLive = () => chartRef.current === chart;

    // Rebuild every series on data change — lightweight-charts has no bulk
    // "replace all series", and the set of overlays varies with user input.
    const created: ISeriesApi<"Candlestick" | "Line">[] = [];
    const add = <T extends "Candlestick" | "Line">(s: ISeriesApi<T>) => {
      created.push(s as ISeriesApi<"Candlestick" | "Line">);
      return s;
    };

    // activeSeries가 null인 건 아직 그 봉 단위 데이터를 못 받아온 순간뿐이다 — 빈 캔들로
    // 렌더링해두면 데이터가 도착하는 대로(같은 effect가 다시 돌면서) 채워진다.
    const dates = activeSeries ? activeSeries.dates : [];
    const candles = activeSeries ? activeSeries.candles : [];

    let bandSeries: ISeriesApi<"Custom"> | null = null;
    if (activeSeries && showBmsb) {
      // 불마켓밴드: 20주 SMA와 21주 EMA 사이를 채운 밴드 (라방 차트의 갈색 띠).
      const bandData: BandData[] = [];
      for (let i = 0; i < dates.length; i++) {
        const a = activeSeries.bmsbSma[i];
        const b = activeSeries.bmsbEma[i];
        if (a == null || b == null) continue;
        bandData.push({ time: toTime(dates[i]), upper: Math.max(a, b), lower: Math.min(a, b) });
      }
      if (bandData.length > 0) {
        bandSeries = chart.addCustomSeries(new BandSeries(), {
          priceLineVisible: false,
          lastValueVisible: false,
          // 밝은 배경에선 옅게, 어두운 배경에선 진하게 — 라방 차트의 갈색 띠 느낌을 맞춘다.
          fillColor: isDark ? "rgba(166, 124, 52, 0.45)" : "rgba(150, 110, 45, 0.3)",
          lineColor: isDark ? "rgba(190, 145, 65, 0.95)" : "rgba(140, 103, 42, 0.85)",
        });
        bandSeries.setData(bandData);
      }
    }

    const candleSeries = add(
      chart.addSeries(CandlestickSeries, {
        upColor: COLORS.up,
        downColor: COLORS.down,
        borderUpColor: COLORS.up,
        borderDownColor: COLORS.down,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
      }),
    );
    candleSeries.setData(
      candles.map((c) => ({
        time: toTime(c.date),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    candleSeriesRef.current = candleSeries;

    let markerApi: ISeriesMarkersPluginApi<Time> | null = null;
    let rsiSeries: ISeriesApi<"Line"> | null = null;

    if (activeSeries) {
      if (showMa) {
        const ma50 = add(
          chart.addSeries(LineSeries, {
            color: COLORS.ma50,
            lineWidth: 1,
            priceLineVisible: false,
            title: `50${intervalLabel}`,
          }),
        );
        ma50.setData(lineData(dates, activeSeries.ma50));

        const ma200 = add(
          chart.addSeries(LineSeries, {
            color: COLORS.ma200,
            lineWidth: 2,
            priceLineVisible: false,
            title: `200${intervalLabel}`,
          }),
        );
        ma200.setData(lineData(dates, activeSeries.ma200));

        // 다른 봉 뷰에선 ma50이 이미 그 봉 단위 "50X"라 여기 또 50주선을 얹으면 겹친다 — 일봉에서만 그린다.
        if (interval === "1d") {
          const ma50w = add(
            chart.addSeries(LineSeries, {
              color: COLORS.ma50w,
              lineWidth: 2,
              priceLineVisible: false,
              title: "50주",
            }),
          );
          ma50w.setData(lineData(dates, activeSeries.ma50w));
        }
      }

      if (realizedPrice != null) {
        const s = add(
          chart.addSeries(LineSeries, {
            color: COLORS.realized,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            title: "실현가격",
          }),
        );
        s.setData(flatLine(dates, realizedPrice));
      }
      if (balancedPrice != null) {
        const s = add(
          chart.addSeries(LineSeries, {
            color: COLORS.balanced,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            title: "밸런스가격",
          }),
        );
        s.setData(flatLine(dates, balancedPrice));
      }

      // 골든/데드크로스 마커
      if (showCrossMarkers) {
        const markers: SeriesMarker<Time>[] = crosses.map((c) => ({
          time: toTime(c.date),
          position: c.type === "golden" ? ("belowBar" as const) : ("aboveBar" as const),
          color: c.type === "golden" ? COLORS.up : COLORS.down,
          shape: c.type === "golden" ? ("arrowUp" as const) : ("arrowDown" as const),
          text: c.type === "golden" ? "골든" : "데드",
        }));
        markerApi = markers.length > 0 ? createSeriesMarkers(candleSeries, markers) : null;
      }

      // RSI 서브차트 (pane 1)
      if (showRsi) {
        rsiSeries = chart.addSeries(
          LineSeries,
          {
            color: COLORS.rsi,
            lineWidth: 1,
            priceLineVisible: false,
            title: interval === "1d" ? "RSI(14)" : `RSI(14, ${intervalLabel})`,
          },
          1,
        );
        rsiSeries.setData(lineData(dates, activeSeries.rsi14));
        // 과매수 70 / 과매도 30 기준선
        for (const level of [70, 30]) {
          rsiSeries.createPriceLine({
            price: level,
            color: isDark ? "#4b4f5c" : "#c9c9cf",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "",
          });
        }
        const panes = chart.panes();
        if (panes.length > 1) {
          panes[0].setHeight(280);
          panes[1].setHeight(90);
        }
      }
    }

    chart.timeScale().fitContent();

    return () => {
      candleSeriesRef.current = null;
      if (!isStillLive()) return; // chart already destroyed — its series went with it
      markerApi?.setMarkers([]);
      for (const s of created) chart.removeSeries(s);
      if (bandSeries) chart.removeSeries(bandSeries);
      if (rsiSeries) chart.removeSeries(rsiSeries);
    };
  }, [
    activeSeries,
    interval,
    intervalLabel,
    crosses,
    showMa,
    showBmsb,
    showRsi,
    showCrossMarkers,
    realizedPrice,
    balancedPrice,
    isDark,
    showIndicators,
  ]);

  return <div className="candle-chart" ref={containerRef} />;
}
