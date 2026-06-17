'use client';

import Link from 'next/link';
import { useState } from 'react';
import Header from '@/components/Header';
import Ticker from '@/components/Ticker';
import LiveRound from '@/components/LiveRound';
import { MARKETS, CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/mockData';
import type { MarketCategory } from '@/lib/types';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: '● Live' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'sports', label: 'Sports' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'finance', label: 'Finance' },
];

const SORTS = [
  { key: 'volume', label: 'Volume' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'newest', label: 'Newest' },
];

export default function MarketsPage() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('volume');
  const [search, setSearch] = useState('');

  let list = MARKETS.filter(m => {
    const matchCat = filter === 'all' || m.category === filter;
    const matchSearch = m.question.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  list = [...list].sort((a, b) => {
    if (sort === 'volume') return b.volume - a.volume;
    if (sort === 'liquidity') return b.liquidity - a.liquidity;
    return new Date(b.expiry).getTime() - new Date(a.expiry).getTime();
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <Ticker />

      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '40px 32px' }}>
        {/* Title */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '8px' }}>
            The floor
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted2)' }}>
            Every market, live. Pick a side, take a position, settle on-chain.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: 'var(--muted)' }}>⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search markets…"
              style={{
                width: '100%', padding: '11px 14px 11px 38px',
                borderRadius: '10px', border: '1px solid var(--border2)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category filters */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '9px 16px', borderRadius: '8px',
                background: filter === f.key ? 'var(--lime)' : 'var(--surface)',
                color: filter === f.key ? '#000' : 'var(--muted2)',
                border: `1px solid ${filter === f.key ? 'var(--lime)' : 'var(--border)'}`,
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}>{f.label}</button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Sort</span>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSort(s.key)} style={{
                padding: '7px 12px', borderRadius: '7px',
                background: 'transparent',
                color: sort === s.key ? 'var(--lime)' : 'var(--muted)',
                border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Grid (or Live round) */}
        {filter === 'live' ? (
          <LiveRound />
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⌕</div>
            <p>No markets match your search.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
            {list.map(m => <MarketCard key={m.id} market={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function MarketCard({ market }: { market: any }) {
  const [hover, setHover] = useState(false);
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  const daysLeft = Math.max(0, Math.ceil((new Date(market.expiry).getTime() - Date.now()) / 86400000));

  return (
    <Link href={`/markets/${market.id}`}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          background: 'var(--surface)', borderRadius: '14px',
          border: `1px solid ${hover ? 'var(--lime)' : 'var(--border)'}`,
          padding: '20px', cursor: 'pointer',
          transition: 'border-color 0.2s, transform 0.2s',
          transform: hover ? 'translateY(-2px)' : 'none',
          height: '100%', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
          <span style={{ fontSize: '15px' }}>{CATEGORY_EMOJI[market.category]}</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {CATEGORY_LABELS[market.category]}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
            {daysLeft}d left
          </span>
        </div>

        <h3 style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.35, marginBottom: '18px', flex: 1 }}>
          {market.question}
        </h3>

        <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ width: `${yesPct}%`, background: 'var(--green)' }} />
          <div style={{ width: `${noPct}%`, background: 'var(--red)' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--green-dim)', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--green)' }}>YES {yesPct}%</span>
          </div>
          <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--red-dim)', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--red)' }}>NO {noPct}%</span>
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
          <span>${(market.volume / 1000).toFixed(0)}K volume</span>
          <span>${(market.liquidity / 1000).toFixed(0)}K liquidity</span>
        </div>
      </div>
    </Link>
  );
}