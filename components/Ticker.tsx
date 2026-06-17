'use client';

import { MARKETS } from '@/lib/mockData';

export default function Ticker() {
  const items = [...MARKETS, ...MARKETS]; // duplicate for seamless loop

  return (
    <div style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      height: '38px',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        gap: '40px',
        whiteSpace: 'nowrap',
        animation: 'tickerScroll 40s linear infinite',
        paddingLeft: '40px',
      }}>
        {items.map((m, i) => {
          const pct = Math.round(m.yesPrice * 100);
          const up = m.yesPrice >= 0.5;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              <span style={{ color: 'var(--muted2)', fontWeight: 600 }}>
                {m.question.length > 42 ? m.question.slice(0, 42) + '…' : m.question}
              </span>
              <span style={{
                color: up ? 'var(--green)' : 'var(--red)',
                fontWeight: 800,
                fontFamily: 'monospace',
              }}>
                {pct}%
              </span>
              <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: '10px' }}>
                {up ? '▲' : '▼'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}