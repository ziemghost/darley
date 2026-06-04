import { useEffect, useRef, useState } from 'react';

interface TickerData {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volumeBase: number;
  volumeQuote: number;
}

interface Props {
  symbol: string;
}

const SYMBOL_LABELS: Record<string, { base: string; quote: string; name: string }> = {
  BTCUSDT: { base: 'BTC', quote: 'USDT', name: 'Bitcoin' },
  ETHUSDT: { base: 'ETH', quote: 'USDT', name: 'Ethereum' },
  SOLUSDT: { base: 'SOL', quote: 'USDT', name: 'Solana' },
};

export function TickerBar({ symbol }: Props) {
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const d = JSON.parse(event.data);
        setTicker({
          price: parseFloat(d.c),
          change: parseFloat(d.p),
          changePct: parseFloat(d.P),
          high: parseFloat(d.h),
          low: parseFloat(d.l),
          volumeBase: parseFloat(d.v),
          volumeQuote: parseFloat(d.q),
        });
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      cancelled = true;
      ws.onmessage = ws.onerror = ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [symbol]);

  const label = SYMBOL_LABELS[symbol] ?? { base: symbol.slice(0, -4), quote: 'USDT', name: '' };
  const isUp = ticker ? ticker.change >= 0 : true;

  return (
    <div className="ticker-bar">
      <div className="ticker-bar__pair">
        <span className="ticker-bar__symbol">{label.base}/{label.quote}</span>
        {label.name && <span className="ticker-bar__name">{label.name}</span>}
      </div>
      {ticker && (
        <>
          <div className="ticker-bar__stat ticker-bar__stat--price">
            <span className={`ticker-bar__value ticker-bar__value--${isUp ? 'up' : 'down'}`}>
              {formatCompact(ticker.price)}
            </span>
          </div>
          <div className="ticker-bar__stat">
            <span className="ticker-bar__label">24h Change</span>
            <span className={`ticker-bar__value ticker-bar__value--${isUp ? 'up' : 'down'}`}>
              {ticker.change >= 0 ? '+' : ''}{formatCompact(ticker.change)} {ticker.changePct >= 0 ? '+' : ''}{ticker.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="ticker-bar__stat">
            <span className="ticker-bar__label">24h High</span>
            <span className="ticker-bar__value">{formatCompact(ticker.high)}</span>
          </div>
          <div className="ticker-bar__stat">
            <span className="ticker-bar__label">24h Low</span>
            <span className="ticker-bar__value">{formatCompact(ticker.low)}</span>
          </div>
          <div className="ticker-bar__stat">
            <span className="ticker-bar__label">24h Vol({label.base})</span>
            <span className="ticker-bar__value">{formatVolShort(ticker.volumeBase)}</span>
          </div>
          <div className="ticker-bar__stat">
            <span className="ticker-bar__label">24h Vol({label.quote})</span>
            <span className="ticker-bar__value">{formatVolShort(ticker.volumeQuote)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatVolShort(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}
