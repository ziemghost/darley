export type Side = 'bid' | 'ask';

export interface Level {
  price: number;
  size: number;
  priceStr: string;
}

export interface DepthSnapshot {
  bids: Level[];
  asks: Level[];
  lastUpdateId: number;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed';

export interface KlineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: number;
  price: number;
  size: number;
  time: number;
  /** true => taker sold (red), false => taker bought (green) */
  isBuyerMaker: boolean;
}

export type KlineInterval = '1s' | '15m' | '1h' | '4h' | '1d' | '1w';
