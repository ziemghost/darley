import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useKlineStream } from '../hooks/useKlineStream';
import type { KlineBar, KlineInterval } from '../types';

interface Props {
  symbol: string;
  interval: KlineInterval;
  intervals: readonly KlineInterval[];
  onIntervalChange: (interval: KlineInterval) => void;
}

const MA_DEFS = [
  { period: 7, color: '#f0b90b' },
  { period: 25, color: '#ff5ed2' },
  { period: 99, color: '#5b8def' },
] as const;

export function PriceChart({ symbol, interval, intervals, onIntervalChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [maVisible, setMaVisible] = useState<boolean[]>(() => MA_DEFS.map(() => true));

  const { bars, liveBar } = useKlineStream(symbol, interval, 300);

  const lastBarsRef = useRef<KlineBar[]>([]);

  // Create the chart once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: '#848e9c',
        fontFamily: 'ui-monospace, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      rightPriceScale: { borderColor: '#2b3139' },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 0 },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.02, bottom: 0.02 } });

    const volumePane = chart.addPane();
    volumePane.setStretchFactor(0.25);
    const volume = volumePane.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const mas = MA_DEFS.map(({ color }) =>
      chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }),
    );

    chartRef.current = chart;
    candleRef.current = candles;
    maRefs.current = mas;
    volumeRef.current = volume;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      maRefs.current = [];
      volumeRef.current = null;
    };
  }, []);

  // Push bar data into the chart series. Uses the cheaper update() path
  // when only the live bar changed on the same history set.
  useEffect(() => {
    const candles = candleRef.current;
    const mas = maRefs.current;
    const volume = volumeRef.current;
    if (!candles || bars.length === 0) return;

    const historyChanged = bars !== lastBarsRef.current;
    lastBarsRef.current = bars;

    if (historyChanged) {
      // Full dataset replacement (symbol/interval change, new closed bar).
      const merged = mergeBarWithLive(bars, liveBar);
      setAllSeriesData(candles, volume, mas, merged);
    } else if (liveBar) {
      // Only the live bar ticked — use update() which is O(1) in the chart.
      const time = Math.floor(liveBar.time / 1000) as UTCTimestamp;
      candles.update({
        time,
        open: liveBar.open,
        high: liveBar.high,
        low: liveBar.low,
        close: liveBar.close,
      });
      if (volume) {
        volume.update({
          time,
          value: liveBar.volume,
          color:
            liveBar.close >= liveBar.open
              ? 'rgba(14, 203, 129, 0.45)'
              : 'rgba(246, 70, 93, 0.45)',
        });
      }
      // Update MA tail for the live bar.
      const merged = mergeBarWithLive(bars, liveBar);
      MA_DEFS.forEach(({ period }, i) => {
        const series = mas[i];
        if (!series || merged.length < period) return;
        const lastMA = computeSMATail(merged, period);
        if (lastMA) series.update(lastMA);
      });
    }
  }, [bars, liveBar]);

  useEffect(() => {
    maRefs.current.forEach((series, i) => {
      series.applyOptions({ visible: maVisible[i] ?? true });
    });
  }, [maVisible]);

  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, [interval, symbol]);

  return (
    <div className="chart-wrapper">
      <div ref={containerRef} />
      <div
        className="chart-overlay chart-overlay--tr switcher switcher--ghost"
        role="group"
        aria-label="Interval"
      >
        {intervals.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === interval}
            onClick={() => onIntervalChange(i)}
          >
            {i}
          </button>
        ))}
      </div>
      <div
        className="chart-overlay chart-overlay--tl chart-legend"
        role="group"
        aria-label="Moving averages"
      >
        {MA_DEFS.map(({ period, color }, i) => {
          const on = maVisible[i] ?? true;
          return (
            <button
              key={period}
              type="button"
              className={`chart-legend__item${on ? '' : ' chart-legend__item--off'}`}
              style={{ color: on ? color : undefined, borderColor: on ? color : undefined }}
              aria-pressed={on}
              onClick={() =>
                setMaVisible((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
              }
            >
              MA{period}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function mergeBarWithLive(bars: KlineBar[], liveBar: KlineBar | null): KlineBar[] {
  if (!liveBar) return bars;
  const last = bars[bars.length - 1];
  if (last && last.time === liveBar.time) {
    const next = bars.slice();
    next[next.length - 1] = liveBar;
    return next;
  }
  return liveBar.time > (last?.time ?? -Infinity) ? bars.concat(liveBar) : bars;
}

function setAllSeriesData(
  candles: ISeriesApi<'Candlestick'>,
  volume: ISeriesApi<'Histogram'> | null,
  mas: ISeriesApi<'Line'>[],
  merged: KlineBar[],
) {
  candles.setData(
    merged.map((b) => ({
      time: Math.floor(b.time / 1000) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    })),
  );

  MA_DEFS.forEach(({ period }, i) => {
    const series = mas[i];
    if (!series) return;
    series.setData(computeSMA(merged, period));
  });

  if (volume) {
    volume.setData(
      merged.map((b) => ({
        time: Math.floor(b.time / 1000) as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? 'rgba(14, 203, 129, 0.45)' : 'rgba(246, 70, 93, 0.45)',
      })),
    );
  }
}

function computeSMA(bars: KlineBar[], period: number): LineData[] {
  if (bars.length < period) return [];
  const out: LineData[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) {
      out.push({
        time: Math.floor(bars[i].time / 1000) as UTCTimestamp,
        value: sum / period,
      });
    }
  }
  return out;
}

function computeSMATail(bars: KlineBar[], period: number): LineData | null {
  if (bars.length < period) return null;
  const start = bars.length - period;
  let sum = 0;
  for (let i = start; i < bars.length; i++) {
    sum += bars[i].close;
  }
  const last = bars[bars.length - 1];
  return {
    time: Math.floor(last.time / 1000) as UTCTimestamp,
    value: sum / period,
  };
}
