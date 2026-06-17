'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { getActiveOracles, getOracleSvi, getOracleState } from '@/lib/api';
import { parseSvi, buildSmile, smileWarnings, type SviParams } from '@/lib/svi';

export default function SurfacePage() {
  const [oracles, setOracles] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [svi, setSvi] = useState<SviParams | null>(null);
  const [spot, setSpot] = useState<number | null>(null);
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [rawSvi, setRawSvi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveOracles().then(list => {
      setOracles(list);
      if (list.length) setSelected(list[0].oracle_id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [sviData, state] = await Promise.all([
        getOracleSvi(selected),
        getOracleState(selected),
      ]);
      if (sviData) { setSvi(parseSvi(sviData)); setRawSvi(sviData); }
      const sp = state?.latest_price?.spot ?? state?.oracle?.spot;
      if (sp) setSpot(Number(sp) / 1e9);
      const exp = state?.oracle?.expiry;
      if (exp) setExpiryMs(Number(exp));
    })();
  }, [selected]);

  const tYears = expiryMs ? Math.max((expiryMs - Date.now()) / (365.25 * 24 * 3600 * 1000), 1 / (365.25 * 24 * 60)) : 1 / (365.25 * 24 * 4);
  const smile = svi && spot ? buildSmile(svi, spot, tYears, 0.05, 49) : [];
  const warnings = smile.length ? smileWarnings(smile) : [];

  // chart dims
  const W = 720, H = 380, padL = 56, padR = 24, padT = 30, padB = 46;
  const ivs = smile.map(p => p.ivPct);
  const minIv = ivs.length ? Math.min(...ivs) : 0;
  const maxIv = ivs.length ? Math.max(...ivs) : 100;
  const ivLo = Math.floor((minIv - 3) / 5) * 5;
  const ivHi = Math.ceil((maxIv + 3) / 5) * 5;
  const xFor = (i: number) => padL + (i / (smile.length - 1)) * (W - padL - padR);
  const yFor = (iv: number) => padT + (1 - (iv - ivLo) / (ivHi - ivLo)) * (H - padT - padB);
  const path = smile.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.ivPct).toFixed(1)}`).join(' ');
  const atmIdx = smile.length ? Math.round((smile.length - 1) / 2) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '12px' }}>VOLATILITY SURFACE</div>
        <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '10px' }}>The live SVI smile.</h1>
        <p style={{ fontSize: '16px', color: 'var(--muted2)', lineHeight: 1.6, maxWidth: '600px', marginBottom: '28px' }}>
          Every DeepBook Predict oracle is priced off a live stochastic-volatility surface, not hand-set odds. This is the implied-volatility smile reconstructed straight from the on-chain SVI parameters.
        </p>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading live oracles…</p>
        ) : oracles.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No active oracles right now — a new round will spin up shortly.</p>
        ) : (
          <>
            {/* Oracle selector */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {oracles.slice(0, 6).map((o, i) => (
                <button key={o.oracle_id} onClick={() => setSelected(o.oracle_id)} style={{
                  padding: '9px 14px', borderRadius: '9px',
                  background: selected === o.oracle_id ? 'var(--lime)' : 'var(--surface)',
                  color: selected === o.oracle_id ? '#000' : 'var(--muted2)',
                  border: `1px solid ${selected === o.oracle_id ? 'var(--lime)' : 'var(--border)'}`,
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>
                  BTC · {new Date(Number(o.expiry)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px', marginBottom: '16px' }}>
              {smile.length ? (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                  {/* grid + y labels */}
                  {Array.from({ length: 6 }).map((_, i) => {
                    const iv = ivLo + (i / 5) * (ivHi - ivLo);
                    const y = yFor(iv);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#222" strokeWidth="1" />
                        <text x={padL - 10} y={y + 4} fill="#666" fontSize="11" textAnchor="end">{iv.toFixed(0)}%</text>
                      </g>
                    );
                  })}
                  {/* ATM vertical line */}
                  <line x1={xFor(atmIdx)} y1={padT} x2={xFor(atmIdx)} y2={H - padB} stroke="#C8FF00" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                  <text x={xFor(atmIdx)} y={H - padB + 16} fill="#C8FF00" fontSize="11" textAnchor="middle">ATM ${spot?.toFixed(0)}</text>
                  {/* x labels */}
                  {[0, atmIdx, smile.length - 1].map((idx, j) => (
                    <text key={j} x={xFor(idx)} y={H - padB + 30} fill="#666" fontSize="10" textAnchor="middle">
                      ${smile[idx].strike.toFixed(0)}
                    </text>
                  ))}
                  {/* smile curve */}
                  <path d={path} fill="none" stroke="#C8FF00" strokeWidth="2.5" strokeLinejoin="round" />
                  {/* ATM dot */}
                  <circle cx={xFor(atmIdx)} cy={yFor(smile[atmIdx].ivPct)} r="5" fill="#C8FF00" />
                  {/* axis titles */}
                  <text x={(W) / 2} y={H - 6} fill="#999" fontSize="12" textAnchor="middle">Strike price</text>
                  <text x={16} y={H / 2} fill="#999" fontSize="12" textAnchor="middle" transform={`rotate(-90 16 ${H / 2})`}>Implied volatility</text>
                </svg>
              ) : (
                <p style={{ color: 'var(--muted)', padding: '40px', textAlign: 'center' }}>Fetching SVI parameters…</p>
              )}
            </div>

            {/* Live params */}
            {svi && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { l: 'a (level)', v: svi.a.toFixed(6) },
                  { l: 'b (slope)', v: svi.b.toFixed(6) },
                  { l: 'ρ (skew)', v: svi.rho.toFixed(3) },
                  { l: 'm (shift)', v: svi.m.toFixed(5) },
                  { l: 'σ (curve)', v: svi.sigma.toFixed(5) },
                ].map(p => (
                  <div key={p.l} style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>{p.l}</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace' }}>{p.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', color: warnings.length ? 'var(--yellow)' : 'var(--green)', fontWeight: 700 }}>
                {warnings.length ? `⚠ ${warnings[0]}` : '✓ Arbitrage-free smile'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Streamed from oracle::OracleSVIUpdated · live on Sui testnet
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}