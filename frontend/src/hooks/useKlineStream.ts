import { useEffect, useRef, useState } from 'react';
import type { KlineBar, KlineInterval } from '../types';

interface KlineMessage {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    x: boolean;
  };
}

export function useKlineStream(
  symbol: string,
  interval: KlineInterval = '15m',
  historyLimit = 300,
) {
  const [bars, setBars] = useState<KlineBar[]>([]);
  const [liveBar, setLiveBar] = useState<KlineBar | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const hasLiveDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasLiveDataRef.current = false;
    setBars([]);
    setLiveBar(null);

    const seed = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${historyLimit}`,
        );
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as unknown[][];
        if (cancelled || hasLiveDataRef.current) return;
        const seeded: KlineBar[] = rows.map((r) => ({
          time: r[0] as number,
          open: parseFloat(r[1] as string),
          high: parseFloat(r[2] as string),
          low: parseFloat(r[3] as string),
          close: parseFloat(r[4] as string),
          volume: parseFloat(r[5] as string),
        }));
        setBars(seeded);
      } catch {
        // non-fatal
      }
    };

    const connect = () => {
      if (cancelled) return;
      const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data) as KlineMessage;
          if (!msg.k) return;
          hasLiveDataRef.current = true;
          const bar: KlineBar = {
            time: msg.k.t,
            open: parseFloat(msg.k.o),
            high: parseFloat(msg.k.h),
            low: parseFloat(msg.k.l),
            close: parseFloat(msg.k.c),
            volume: parseFloat(msg.k.v),
          };
          if (msg.k.x) {
            setBars((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.time === bar.time) {
                const next = prev.slice();
                next[next.length - 1] = bar;
                return next;
              }
              const next = prev.concat(bar);
              return next.length > historyLimit ? next.slice(next.length - historyLimit) : next;
            });
            setLiveBar(null);
          } else {
            setLiveBar(bar);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (cancelled) return;
        const attempt = ++reconnectAttemptRef.current;
        const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5)) + Math.random() * 250;
        reconnectTimerRef.current = globalThis.setTimeout(connect, delay);
      };
    };

    void seed();
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        globalThis.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
      wsRef.current = null;
    };
  }, [symbol, interval, historyLimit]);

  return { bars, liveBar };
}
