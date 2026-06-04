import { memo } from 'react';
import { useTradeStream } from '../hooks/useTradeStream';
import { formatPrice, formatSize } from '../format';
import type { Trade } from '../types';

interface Props {
  symbol: string;
}

export function Trades({ symbol }: Props) {
  const { trades } = useTradeStream(symbol, 40);

  if (trades.length === 0) {
    return <div className="empty">Loading trades for {symbol}…</div>;
  }

  const decimals = priceDecimalsForSymbol(trades[0]?.price ?? 0);

  return (
    <div className="trades" aria-label={`Market trades for ${symbol}`}>
      <div className="trades__col-header" aria-hidden>
        <span>Price (USDT)</span>
        <span>Amount</span>
        <span>Time</span>
      </div>
      <div className="trades__list">
        {trades.map((t) => (
          <TradeRow key={t.id} trade={t} decimals={decimals} />
        ))}
      </div>
    </div>
  );
}

const TradeRow = memo(function TradeRow({
  trade,
  decimals,
}: {
  trade: Trade;
  decimals: number;
}) {
  const side = trade.isBuyerMaker ? 'sell' : 'buy';
  return (
    <div className={`trades__row trades__row--${side}`}>
      <span className="price">{formatPrice(trade.price, decimals)}</span>
      <span className="size">{formatSize(trade.size)}</span>
      <span className="time">{formatTime(trade.time)}</span>
    </div>
  );
});

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Heuristic: more decimals for cheaper assets so sub-cent moves are visible. */
function priceDecimalsForSymbol(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 4;
  return 6;
}
