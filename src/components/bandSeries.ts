import {
  customSeriesDefaultOptions,
  type CustomData,
  type CustomSeriesOptions,
  type CustomSeriesPricePlotValues,
  type ICustomSeriesPaneRenderer,
  type ICustomSeriesPaneView,
  type PaneRendererCustomData,
  type PriceToCoordinateConverter,
  type Time,
} from "lightweight-charts";

/**
 * A filled band between two price lines — the shape 라방 charts use for the
 * Bull Market Support Band. lightweight-charts has no built-in "fill between two
 * series", so this is a custom series that paints the region itself.
 */
export interface BandData extends CustomData<Time> {
  upper: number;
  lower: number;
}

export interface BandSeriesOptions extends CustomSeriesOptions {
  fillColor: string;
  lineColor: string;
  lineWidth: number;
}

export const defaultBandOptions: BandSeriesOptions = {
  ...customSeriesDefaultOptions,
  fillColor: "rgba(150, 110, 45, 0.28)",
  lineColor: "rgba(150, 110, 45, 0.9)",
  lineWidth: 1,
} as const;

class BandRenderer implements ICustomSeriesPaneRenderer {
  private _data: PaneRendererCustomData<Time, BandData> | null = null;
  private _options: BandSeriesOptions | null = null;

  update(data: PaneRendererCustomData<Time, BandData>, options: BandSeriesOptions): void {
    this._data = data;
    this._options = options;
  }

  draw(target: { useBitmapCoordinateSpace: (cb: (scope: BitmapScope) => void) => void }, priceToCoordinate: PriceToCoordinateConverter): void {
    target.useBitmapCoordinateSpace((scope) => this._drawImpl(scope, priceToCoordinate));
  }

  private _drawImpl(scope: BitmapScope, priceToCoordinate: PriceToCoordinateConverter): void {
    const data = this._data;
    const options = this._options;
    if (data === null || options === null || data.bars.length === 0 || data.visibleRange === null) return;

    const ctx = scope.context;
    const ratio = scope.horizontalPixelRatio;
    const vRatio = scope.verticalPixelRatio;

    type Pt = { x: number; upper: number; lower: number };
    const points: Pt[] = [];
    for (let i = data.visibleRange.from; i < data.visibleRange.to; i++) {
      const bar = data.bars[i];
      const upper = priceToCoordinate(bar.originalData.upper);
      const lower = priceToCoordinate(bar.originalData.lower);
      if (upper === null || lower === null) continue;
      points.push({ x: bar.x * ratio, upper: upper * vRatio, lower: lower * vRatio });
    }
    if (points.length < 2) return;

    ctx.save();

    // Fill: down the upper edge, back along the lower edge.
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].upper);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].upper);
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].x, points[i].lower);
    ctx.closePath();
    ctx.fillStyle = options.fillColor;
    ctx.fill();

    // Edges
    ctx.lineWidth = options.lineWidth * vRatio;
    ctx.strokeStyle = options.lineColor;
    for (const edge of ["upper", "lower"] as const) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0][edge]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i][edge]);
      ctx.stroke();
    }

    ctx.restore();
  }
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

export class BandSeries implements ICustomSeriesPaneView<Time, BandData, BandSeriesOptions> {
  private _renderer = new BandRenderer();

  priceValueBuilder(plotRow: BandData): CustomSeriesPricePlotValues {
    return [plotRow.lower, plotRow.upper];
  }

  isWhitespace(data: BandData | { time: Time }): data is { time: Time } {
    return (data as BandData).upper === undefined || (data as BandData).lower === undefined;
  }

  renderer(): ICustomSeriesPaneRenderer {
    return this._renderer;
  }

  update(data: PaneRendererCustomData<Time, BandData>, options: BandSeriesOptions): void {
    this._renderer.update(data, options);
  }

  defaultOptions(): BandSeriesOptions {
    return defaultBandOptions;
  }
}
