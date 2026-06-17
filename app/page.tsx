'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Ticker from '@/components/Ticker';
import RollingNumber from '@/components/RollingNumber';
import { useStats } from '@/lib/useStats';
import { MARKETS, CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/mockData';

export default function HomePage() {
  const stats = useStats();
  const [spotlight, setSpotlight] = useState(0);

  // Rotate the spotlight market every 4s — keeps the board alive
  useEffect(() => {
    const id = setInterval(() => setSpotlight(s => (s + 1) % MARKETS.length), 4000);
    return () => clearInterval(id);
  }, []);

  const featured = MARKETS[spotlight];
  // Landing shows a curated teaser; the full floor lives on /markets.
  const board = MARKETS.slice(0, 7);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <Ticker />

      {/* ===== HERO: split — editorial type left, live spotlight card right ===== */}
      <section style={{
        maxWidth: '1240px', margin: '0 auto', padding: '56px 32px 32px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '56px', alignItems: 'center',
      }}>
        {/* Left — bold asymmetric statement */}
        <div style={{ animation: 'fadeUp 0.5s ease both' }}>
          <div style={{
            fontSize: '13px', fontWeight: 800, color: 'var(--lime)',
            letterSpacing: '3px', marginBottom: '20px',
          }}>
            STRUCTURED LIQUIDITY ON DEEPBOOK PREDICT
          </div>
          <h1 style={{
            fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 900,
            lineHeight: 1.04, letterSpacing: '-2.5px', marginBottom: '0',
            paddingTop: '4px',
          }}>
            <span style={{ display: 'block' }}>Earn the</span>
            <span style={{ display: 'block', color: 'var(--lime)' }}>house's yield.</span>
            <span style={{ display: 'block' }}>Survive the crash.</span>
          </h1>

          <p style={{ fontSize: '17px', color: 'var(--muted2)', lineHeight: 1.6, marginTop: '22px', maxWidth: '480px' }}>
            A vault that supplies to the DeepBook Predict liquidity pool and hedges its own tail — PLP yield with built-in crash insurance. All on a live, on-chain prediction market.
          </p>

          <div style={{ display: 'flex', gap: '14px', marginTop: '32px' }}>
            <Link href="/strategy" style={{
              padding: '15px 30px', borderRadius: '12px',
              background: 'var(--lime)', color: '#000',
              fontSize: '16px', fontWeight: 800,
              boxShadow: '0 0 40px rgba(200,255,0,0.3)',
            }}>Open the vault →</Link>
            <Link href="/markets" style={{
              padding: '15px 30px', borderRadius: '12px',
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border2)', fontSize: '16px', fontWeight: 700,
            }}>See the market</Link>
          </div>

          {/* Real stats — only render the ones the server actually returns */}
          <div style={{ display: 'flex', gap: '32px', marginTop: '40px' }}>
            {stats.vaultValue !== null && (
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)' }}>
                  <RollingNumber value={stats.vaultValue} prefix="$" />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Vault liquidity</div>
              </div>
            )}
            {stats.marketCount !== null && stats.marketCount > 0 && stats.marketCount < 500 && (
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text)' }}>
                  <RollingNumber value={stats.marketCount} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Live oracles</div>
              </div>
            )}
            {stats.serverOnline && (
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)', animation: 'pulse 2s infinite' }} />
                  Live
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>DeepBook feed</div>
              </div>
            )}
          </div>
        </div>

        {/* Right — live rotating spotlight card */}
        <div style={{ animation: 'fadeUp 0.5s ease 0.1s both' }}>
          <SpotlightCard market={featured} />
        </div>
      </section>

      {/* ===== PLATFORM ===== */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 32px 30px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '2px', color: 'var(--muted2)', marginBottom: '6px' }}>
          THE FULL STACK
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--muted2)', marginBottom: '24px', maxWidth: '600px', lineHeight: 1.6 }}>
          A structured-product layer on DeepBook Predict — trade positions, provide liquidity, hedge the tail, and inspect the live volatility surface.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {[
            { href: '/strategy', tag: 'STRUCTURED VAULT', title: 'PLP + Hedge', desc: 'Earn the house yield with crash insurance built in.' },
            { href: '/surface', tag: 'ANALYTICS', title: 'Vol Surface', desc: 'The live SVI smile, straight from on-chain oracle params.' },
            { href: '/risk', tag: 'ANALYTICS', title: 'PLP Risk', desc: 'Stress-test LP value under extreme BTC moves.' },
            { href: '/markets', tag: 'LIVE MARKET', title: 'Prediction Floor', desc: 'The real on-chain market the vault is built on.' },
          ].map(c => (
            <Link key={c.href} href={c.href} style={{
              background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)',
              padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px',
              transition: 'border-color 0.2s, transform 0.2s',
            }}>
              <div style={{ width: '28px', height: '3px', background: 'var(--lime)', borderRadius: '2px' }} />
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '1.5px', marginTop: '4px' }}>{c.tag}</div>
              <div style={{ fontSize: '18px', fontWeight: 800 }}>{c.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted2)', lineHeight: 1.5 }}>{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== THE BOARD: asymmetric editorial grid ===== */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '40px 32px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '2px', color: 'var(--muted2)' }}>
            ALL MARKETS
          </h2>
          <Link href="/markets" style={{ fontSize: '14px', color: 'var(--lime)', fontWeight: 700 }}>
            See everything →
          </Link>
        </div>

        {/* Asymmetric grid: first card spans 2 cols & 2 rows, rest flow around it */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridAutoRows: '160px',
          gap: '14px',
        }}>
          {board.map((m, i) => {
            // Make some cards bigger for editorial rhythm
            const big = i === 0;
            const wide = i === 3 || i === 6;
            return (
              <BoardCard
                key={m.id}
                market={m}
                style={{
                  gridColumn: big ? 'span 2' : wide ? 'span 2' : 'span 1',
                  gridRow: big ? 'span 2' : 'span 1',
                }}
                big={big}
              />
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Predict. Win. Repeat.</span>
      </footer>
    </div>
  );
}

/* ---------- Spotlight card (rotating, animated) ---------- */
function SpotlightCard({ market }: { market: any }) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--surface) 0%, var(--bg2) 100%)',
      borderRadius: '20px',
      border: '1px solid var(--border2)',
      padding: '28px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    }}>
      {/* glow */}
      <div style={{
        position: 'absolute', top: '-60px', right: '-60px',
        width: '200px', height: '200px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,255,0,0.12) 0%, transparent 70%)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <span style={{ fontSize: '20px' }}>{CATEGORY_EMOJI[market.category]}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {CATEGORY_LABELS[market.category]}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--green)', fontWeight: 700 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.5s infinite' }} />
          TRENDING
        </span>
      </div>

      <h3 style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.25, marginBottom: '28px', minHeight: '90px' }}>
        {market.question}
      </h3>

      {/* Big animated probability */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '56px', fontWeight: 900, color: 'var(--lime)', lineHeight: 1, letterSpacing: '-2px' }}>
          <RollingNumber value={yesPct} suffix="%" duration={600} />
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted2)', fontWeight: 600, marginBottom: '8px' }}>chance YES</div>
      </div>

      {/* Odds bar */}
      <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', marginTop: '16px', marginBottom: '20px' }}>
        <div style={{ width: `${yesPct}%`, background: 'var(--green)', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${noPct}%`, background: 'var(--red)', transition: 'width 0.6s ease' }} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{ flex: 1, padding: '13px', borderRadius: '10px', background: 'var(--green-dim)', border: '1px solid rgba(0,255,135,0.3)', color: 'var(--green)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}>
          Buy YES · {yesPct}¢
        </button>
        <button style={{ flex: 1, padding: '13px', borderRadius: '10px', background: 'var(--red-dim)', border: '1px solid rgba(255,59,59,0.3)', color: 'var(--red)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}>
          Buy NO · {noPct}¢
        </button>
      </div>
    </div>
  );
}

/* ---------- Board card (grid tile) ---------- */
function BoardCard({ market, style, big }: { market: any; style: React.CSSProperties; big?: boolean }) {
  const [hover, setHover] = useState(false);
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  return (
    <Link href={`/markets/${market.id}`} style={style}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          height: '100%',
          background: 'var(--surface)',
          borderRadius: '14px',
          border: `1px solid ${hover ? 'var(--lime)' : 'var(--border)'}`,
          padding: big ? '24px' : '18px',
          cursor: 'pointer',
          transition: 'border-color 0.2s, transform 0.2s',
          transform: hover ? 'translateY(-2px)' : 'none',
          display: 'flex', flexDirection: 'column',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: 'auto' }}>
          <span style={{ fontSize: big ? '18px' : '14px' }}>{CATEGORY_EMOJI[market.category]}</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {CATEGORY_LABELS[market.category]}
          </span>
        </div>

        <h3 style={{
          fontSize: big ? '22px' : '14px', fontWeight: 700,
          lineHeight: 1.3, margin: '12px 0',
        }}>
          {big ? market.question : (market.question.length > 60 ? market.question.slice(0, 60) + '…' : market.question)}
        </h3>

        {/* Odds */}
        <div>
          <div style={{ display: 'flex', height: big ? '8px' : '5px', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: `${yesPct}%`, background: 'var(--green)', transition: 'width 0.5s ease' }} />
            <div style={{ width: `${noPct}%`, background: 'var(--red)', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: big ? '14px' : '12px', fontWeight: 800, color: 'var(--green)' }}>YES {yesPct}%</span>
            <span style={{ fontSize: big ? '14px' : '12px', fontWeight: 800, color: 'var(--red)' }}>NO {noPct}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
}