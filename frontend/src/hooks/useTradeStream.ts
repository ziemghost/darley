import { useEffect, useRef, useState } from 'react';
import type { Trade } from '../types';

interface AggTradeMessage {
  e: 'aggTrade';
  E: number;
  s: string;
  a: number; // aggregate trade id
  p: string; // price
  q: string; // quantity
  T: number; // trade time
  m: boolean; // is buyer the market maker (true => taker sold, "sell" trade)
}

export function useTradeStream(symbol: string, max = 50) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrades([]);

    const seed = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/aggTrades?symbol=${symbol.toUpperCase()}&limit=${max}`,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          a: number;
          p: string;
          q: string;
          T: number;
          m: boolean;
        }>;
        if (cancelled) return;
        const seeded: Trade[] = rows
          .map((r) => ({
            id: r.a,
            price: parseFloat(r.p),
            size: parseFloat(r.q),
            time: r.T,
            isBuyerMaker: r.m,
          }))
          .reverse(); // newest first
        setTrades(seeded.slice(0, max));
      } catch {
        // non-fatal: live stream will populate the panel
      }
    };

    const connect = () => {
      if (cancelled) return;
      const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data) as AggTradeMessage;
          if (msg.e !== 'aggTrade') return;
          const trade: Trade = {
            id: msg.a,
            price: parseFloat(msg.p),
            size: parseFloat(msg.q),
            time: msg.T,
            isBuyerMaker: msg.m,
          };
          setTrades((prev) => {
            if (prev.length && prev[0].id === trade.id) return prev;
            const next = [trade, ...prev];
            return next.length > max ? next.slice(0, max) : next;
          });
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (cancelled) return;
        const attempt = ++reconnectAttemptRef.current;
        const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5)) + Math.random() * 250;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    void seed();
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
  }, [symbol, max]);

  return { trades };
}
