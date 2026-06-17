'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { getVaultSummary } from '@/lib/api';
import { parseVaultRisk, stressScenario, healthScore, type VaultRisk } from '@/lib/risk';
import { runSimulation } from '@/lib/simulation';

export default function RiskPage() {
  const [risk, setRisk] = useState<VaultRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [assumedUtil, setAssumedUtil] = useState(60); // % — default realistic level
  const [hedgeRatio, setHedgeRatio] = useState(30); // % of yield to hedges

  useEffect(() => {
    getVaultSummary().then(v => {
      setRisk(parseVaultRisk(v));
      setLoading(false);
    });
  }, []);

  const sim = runSimulation({ deposit: 1000, plpApy: 25, hedgeRatio: hedgeRatio / 100, protection: 0.5, periods: 24 });
  const health = risk ? healthScore(risk) : null;
  const scenarios = risk ? [-5, -3, -1, 1, 3, 5].map(s => stressScenario(risk, s, assumedUtil / 100)) : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '12px' }}>PLP RISK</div>
        <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '10px' }}>Is the vault safe?</h1>
        <p style={{ fontSize: '16px', color: 'var(--muted2)', lineHeight: 1.6, maxWidth: '600px', marginBottom: '28px' }}>
          The question that gates every serious LP. Live vault utilization, payout coverage, and a stress test of PLP value under extreme BTC moves — all from on-chain vault state.
        </p>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading live vault state…</p>
        ) : !risk ? (
          <p style={{ color: 'var(--muted)' }}>Vault data unavailable right now.</p>
        ) : (
          <>
            {/* Health score */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '28px' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#222" strokeWidth="12" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={health!.color} strokeWidth="12"
                    strokeDasharray={`${(health!.score / 100) * 327} 327`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: health!.color }}>{health!.score}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>/ 100</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>VAULT HEALTH</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: health!.color, marginBottom: '8px' }}>{health!.label}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted2)', lineHeight: 1.5, maxWidth: '380px' }}>
                  Derived from {(risk.utilization * 100).toFixed(2)}% capital utilization and {(risk.maxPayoutUtilization * 100).toFixed(2)}% max-payout coverage. Lower utilization means more buffer against adverse settlements.
                </div>
              </div>
            </div>

            {/* Core metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
              {[
                { l: 'TVL', v: `$${Math.round(risk.tvl).toLocaleString()}` },
                { l: 'Available liquidity', v: `$${Math.round(risk.availableLiquidity).toLocaleString()}` },
                { l: 'PLP share price', v: `$${risk.sharePrice.toFixed(4)}`, c: 'var(--green)' },
                { l: 'Utilization', v: `${(risk.utilization * 100).toFixed(2)}%` },
              ].map(m => (
                <div key={m.l} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>{m.l}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: m.c || 'var(--text)' }}>{m.v}</div>
                </div>
              ))}
            </div>

            {/* Stress test */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '6px' }}>STRESS TEST — PLP VALUE UNDER A BTC SHOCK</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>Estimated impact on PLP share price under sudden BTC moves of varying magnitude.</p>

              {/* Utilization slider */}
              <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600 }}>Assumed vault utilization</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--lime)' }}>{assumedUtil}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={assumedUtil}
                  onChange={e => setAssumedUtil(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#C8FF00', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  <span>Idle (0%)</span>
                  <span>Live: {(risk.utilization * 100).toFixed(2)}%</span>
                  <span>Fully deployed (100%)</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {scenarios.map(s => {
                  const neg = s.pctChange < 0;
                  const mag = Math.min(100, Math.abs(s.pctChange) * 8);
                  return (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '110px', fontSize: '13px', fontWeight: 700, color: 'var(--muted2)' }}>{s.label}</div>
                      <div style={{ flex: 1, height: '26px', background: 'var(--bg2)', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${mag}%`, background: neg ? 'var(--red-dim)' : 'var(--green-dim)', borderRight: `2px solid ${neg ? 'var(--red)' : 'var(--green)'}` }} />
                      </div>
                      <div style={{ width: '90px', textAlign: 'right', fontSize: '14px', fontWeight: 800, color: neg ? 'var(--red)' : 'var(--green)' }}>
                        {s.pctChange >= 0 ? '+' : ''}{s.pctChange.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '16px', lineHeight: 1.5 }}>
                Live vault utilization is currently {(risk.utilization * 100).toFixed(2)}%, so real PLP risk today is minimal. Drag the slider to model PLP behavior at higher deployment levels — the scenario any LP cares about before committing serious capital.
              </p>
            </div>

            {/* PLP + HEDGE SIMULATION — the proof of the structured vault */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '6px' }}>SIMULATION — PLP vs PLP+HEDGE THROUGH TWO BTC CRASHES</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>
                A $1,000 deposit run through 24 settlement periods including a −28% and a −19% BTC shock. The hedge spends a slice of yield on downside binaries that pay out in the crashes.
              </p>

              {/* Hedge ratio control */}
              <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600 }}>Hedge ratio (yield spent on crash insurance)</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--lime)' }}>{hedgeRatio}%</span>
                </div>
                <input type="range" min="0" max="60" value={hedgeRatio} onChange={e => setHedgeRatio(Number(e.target.value))} style={{ width: '100%', accentColor: '#C8FF00', cursor: 'pointer' }} />
              </div>

              {/* Line chart */}
              {(() => {
                const W = 640, H = 240, padL = 50, padR = 16, padT = 16, padB = 28;
                const vals = sim.points.flatMap(p => [p.plpValue, p.hedgedValue]).concat([1000]);
                const lo = Math.min(...vals), hi = Math.max(...vals);
                const x = (i: number) => padL + (i / (sim.points.length - 1)) * (W - padL - padR);
                const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
                const line = (key: 'plpValue' | 'hedgedValue') => sim.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                    {[lo, (lo + hi) / 2, hi].map((v, i) => (
                      <g key={i}>
                        <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#222" strokeWidth="1" />
                        <text x={padL - 8} y={y(v) + 4} fill="#666" fontSize="10" textAnchor="end">${v.toFixed(0)}</text>
                      </g>
                    ))}
                    <line x1={padL} y1={y(1000)} x2={W - padR} y2={y(1000)} stroke="#444" strokeWidth="1" strokeDasharray="3 3" />
                    <path d={line('plpValue')} fill="none" stroke="#FF3B3B" strokeWidth="2.5" />
                    <path d={line('hedgedValue')} fill="none" stroke="#C8FF00" strokeWidth="2.5" />
                  </svg>
                );
              })()}

              <div style={{ display: 'flex', gap: '20px', marginTop: '10px', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '3px', background: 'var(--lime)', display: 'inline-block' }} /> PLP + Hedge</span>
                <span style={{ fontSize: '12px', color: 'var(--muted2)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '14px', height: '3px', background: 'var(--red)', display: 'inline-block' }} /> Raw PLP</span>
              </div>

              {/* Result cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '8px' }}>RAW PLP</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted2)', marginBottom: '4px' }}>Return: <span style={{ fontWeight: 800, color: sim.plpReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{sim.plpReturn >= 0 ? '+' : ''}{sim.plpReturn.toFixed(1)}%</span></div>
                  <div style={{ fontSize: '13px', color: 'var(--muted2)' }}>Max drawdown: <span style={{ fontWeight: 800, color: 'var(--red)' }}>−{sim.plpMaxDrawdown.toFixed(1)}%</span></div>
                </div>
                <div style={{ background: 'var(--lime-dim)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(200,255,0,0.25)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--lime)', fontWeight: 700, marginBottom: '8px' }}>PLP + HEDGE</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted2)', marginBottom: '4px' }}>Return: <span style={{ fontWeight: 800, color: sim.hedgedReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>{sim.hedgedReturn >= 0 ? '+' : ''}{sim.hedgedReturn.toFixed(1)}%</span></div>
                  <div style={{ fontSize: '13px', color: 'var(--muted2)' }}>Max drawdown: <span style={{ fontWeight: 800, color: 'var(--green)' }}>−{sim.hedgedMaxDrawdown.toFixed(1)}%</span></div>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.5 }}>
                Deterministic model: PLP accrues yield each period and absorbs ~60% of down moves as option liability; the hedge reimburses the protected fraction in crashes. The hedge cuts max drawdown by roughly half for a modest yield give-up.
              </p>
            </div>

            {/* Flow stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { l: 'Total supplied', v: `$${Math.round(risk.totalSupplied).toLocaleString()}` },
                { l: 'Total withdrawn', v: `$${Math.round(risk.totalWithdrawn).toLocaleString()}` },
                { l: 'Net deposits', v: `$${Math.round(risk.netDeposits).toLocaleString()}` },
              ].map(m => (
                <div key={m.l} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>{m.l}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{m.v}</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '16px' }}>
              Live from the DeepBook Predict vault on Sui testnet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}