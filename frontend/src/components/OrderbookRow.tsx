import { memo } from 'react';
import { formatPrice, formatSize } from '../format';
import type { Side } from '../types';

interface Props {
  price: number;
  size: number;
  total: number;
  depthPct: number;
  side: Side;
  priceDecimals: number;
}

function OrderbookRowImpl({ price, size, total, depthPct, side, priceDecimals }: Props) {
  return (
    <div
      className={`orderbook__row orderbook__row--${side}`}
      style={{ ['--depth' as string]: `${depthPct}%` }}
    >
      <span className="price">{formatPrice(price, priceDecimals)}</span>
      <span className="size">{formatSize(size)}</span>
      <span className="total">{formatSize(total)}</span>
    </div>
  );
}

export const OrderbookRow = memo(OrderbookRowImpl);
