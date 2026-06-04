import { useCallback, useState } from 'react';
import { Orderbook } from './components/Orderbook';
import { PriceChart } from './components/PriceChart';
import { TickerBar } from './components/TickerBar';
import { Trades } from './components/Trades';
import type { ConnectionStatus, KlineInterval } from './types';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
type Symbol = (typeof SYMBOLS)[number];

const INTERVALS: KlineInterval[] = ['1s', '15m', '1h', '4h', '1d', '1w'];


type MobileTab = 'chart' | 'orderbook' | 'trades';

export default function App() {
  const [symbol, setSymbol] = useState<Symbol>('BTCUSDT');
  const [interval, setInterval] = useState<KlineInterval>('15m');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');

  const handleStatusChange = useCallback((s: ConnectionStatus) => setStatus(s), []);

  return (
    <div className="app" data-mobile-tab={mobileTab}>
      <header className="app__header">
        <div className="switcher" role="group" aria-label="Symbol">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === symbol}
              onClick={() => setSymbol(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <TickerBar symbol={symbol} />
        <span className={`status status--${status}`} aria-live="polite">
          <span className="status__dot" />
        </span>
      </header>

      <main className="layout">
        <section className="panel panel--trades" data-tab="trades" aria-label="Market trades">
          <div className="panel__header">
            <span>Market Trades</span>
          </div>
          <Trades symbol={symbol} />
        </section>

        <section className="panel panel--chart" data-tab="chart" aria-label="Price chart">
          <PriceChart
            symbol={symbol}
            interval={interval}
            intervals={INTERVALS}
            onIntervalChange={setInterval}
          />
        </section>

        <section className="panel panel--orderbook" data-tab="orderbook" aria-label="Order book">
          <div className="panel__header">
            <span>Order Book</span>
          </div>
          <Orderbook symbol={symbol} onStatusChange={handleStatusChange} />
        </section>
      </main>

      <nav
        className="mobile-tabs"
        role="tablist"
        aria-label="Panels"
        data-active={mobileTab}
      >
        <button type="button" role="tab" aria-selected={mobileTab === 'chart'} onClick={() => setMobileTab('chart')}>Chart</button>
        <button type="button" role="tab" aria-selected={mobileTab === 'orderbook'} onClick={() => setMobileTab('orderbook')}>Order Book</button>
        <button type="button" role="tab" aria-selected={mobileTab === 'trades'} onClick={() => setMobileTab('trades')}>Trades</button>
      </nav>
    </div>
  );
}
