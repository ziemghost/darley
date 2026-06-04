import { useEffect, useRef, useState } from 'react';
import type { ConnectionStatus, DepthSnapshot, Level } from '../types';

export function useDepthStream(symbol: string, levels: 5 | 10 | 20 = 20) {
  const [snapshot, setSnapshot] = useState<DepthSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const reconnectAttemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth${levels}@100ms`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectAttemptRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          // Partial-depth payload shape:
          // { lastUpdateId, bids: [[price, qty], ...], asks: [[price, qty], ...] }
          const data = JSON.parse(event.data) as {
            lastUpdateId: number;
            bids: [string, string][];
            asks: [string, string][];
          };
          setSnapshot({
            lastUpdateId: data.lastUpdateId,
            bids: parseLevels(data.bids),
            asks: parseLevels(data.asks),
          });
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        // onclose will follow and trigger the reconnect path
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus('closed');
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const attempt = ++reconnectAttemptRef.current;
      // Exponential backoff capped at 10s, with small jitter.
      const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5));
      const jitter = Math.random() * 250;
      reconnectTimerRef.current = window.setTimeout(connect, delay + jitter);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
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
  }, [symbol, levels]);

  return { snapshot, status };
}

function parseLevels(raw: [string, string][]): Level[] {
  const out: Level[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const [p, q] = raw[i];
    out[i] = { priceStr: p, price: parseFloat(p), size: parseFloat(q) };
  }
  return out;
}
