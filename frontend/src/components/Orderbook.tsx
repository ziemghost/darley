import { useEffect, useMemo, useRef } from 'react';
import { useDepthStream } from '../hooks/useDepthStream';
import { formatPrice, inferPriceDecimals } from '../format';
import { OrderbookRow } from './OrderbookRow';
import type { ConnectionStatus } from '../types';

interface Props {
  symbol: string;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function Orderbook({ symbol, onStatusChange }: Props) {
  const { snapshot, status } = useDepthStream(symbol, 20);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const prevMidRef = useRef<number | null>(null);
  const midDirRef = useRef<'up' | 'down' | null>(null);

  const view = useMemo(() => {
    if (!snapshot) return null;
    const { bids, asks } = snapshot;

    let bidCum = 0;
    const bidRows = bids.map((l) => {
      bidCum += l.size;
      return { ...l, total: bidCum };
    });

    let askCum = 0;
    const askRows = asks.map((l) => {
      askCum += l.size;
      return { ...l, total: askCum };
    });

    const maxTotal = Math.max(bidCum, askCum, 1e-12);

    const bestBid = bidRows[0]?.price;
    const bestAsk = askRows[0]?.price;
    const mid =
      bestBid !== undefined && bestAsk !== undefined ? (bestBid + bestAsk) / 2 : undefined;
    const spread =
      bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : undefined;
    const spreadPct =
      mid !== undefined && spread !== undefined && mid > 0 ? (spread / mid) * 100 : undefined;

    const priceDecimals = Math.max(
      inferPriceDecimals(bidRows[0]?.priceStr ?? ''),
      inferPriceDecimals(askRows[0]?.priceStr ?? ''),
      2,
    );

    return { bidRows, askRows, maxTotal, mid, spread, spreadPct, priceDecimals };
  }, [snapshot]);

  // Derive mid-price direction without an extra render cycle.
  if (view?.mid !== undefined) {
    const prev = prevMidRef.current;
    if (prev !== null && view.mid !== prev) {
      midDirRef.current = view.mid > prev ? 'up' : 'down';
    }
    prevMidRef.current = view.mid;
  }
  const midDir = midDirRef.current;

  if (!view) {
    return <div className="empty">Loading orderbook for {symbol}…</div>;
  }

  const { bidRows, askRows, maxTotal, mid, spread, spreadPct, priceDecimals } = view;

  return (
    <div className="orderbook" aria-label={`Order book for ${symbol}`}>
      <div className="orderbook__col-header" aria-hidden>
        <span>Price (USDT)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      <div className="orderbook__side orderbook__side--asks">
        {askRows.map((l) => (
          <OrderbookRow
            key={`a-${l.priceStr}`}
            price={l.price}
            size={l.size}
            total={l.total}
            depthPct={(l.total / maxTotal) * 100}
            side="ask"
            priceDecimals={priceDecimals}
          />
        ))}
      </div>

      <div className="orderbook__spread">
        <span className="label">Mid</span>
        <span className={`mid ${midDir ? `mid--${midDir}` : ''}`}>
          {mid !== undefined ? formatPrice(mid, priceDecimals) : '—'}
        </span>
        <span className="spread">
          {spread !== undefined ? `Spread ${formatPrice(spread, priceDecimals)}` : ''}
          {spreadPct !== undefined ? ` (${spreadPct.toFixed(3)}%)` : ''}
        </span>
      </div>

      <div className="orderbook__side">
        {bidRows.map((l) => (
          <OrderbookRow
            key={`b-${l.priceStr}`}
            price={l.price}
            size={l.size}
            total={l.total}
            depthPct={(l.total / maxTotal) * 100}
            side="bid"
            priceDecimals={priceDecimals}
          />
        ))}
      </div>
    </div>
  );
}
