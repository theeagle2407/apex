'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { toBase64 } from '@mysten/sui/utils';
import Header from '@/components/Header';
import { getVaultSummary, getActiveOracle } from '@/lib/api';
import { computeStrategy, estimatePlpApy } from '@/lib/strategy';
import { buildSupplyHedgeTx, buildCreateManagerTx, findDusdcCoin, findManager, managerIdFromEffects } from '@/lib/trade';

export default function StrategyPage() {
  const [deposit, setDeposit] = useState(1000);
  const [hedgeRatio, setHedgeRatio] = useState(25);      // % of yield to insurance
  const [crashProtection, setCrashProtection] = useState(30); // % of deposit protected
  const [basePlpApy, setBasePlpApy] = useState(12);
  const [sharePrice, setSharePrice] = useState<number | null>(null);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [txDigest, setTxDigest] = useState('');

  useEffect(() => {
    getVaultSummary().then(v => {
      if (v?.plp_share_price) {
        setSharePrice(v.plp_share_price);
        setBasePlpApy(estimatePlpApy(v.plp_share_price));
      }
    });
  }, []);

  const r = computeStrategy({ deposit, basePlpApy, hedgeRatio: hedgeRatio / 100, crashProtection });

  // Split: most of the deposit supplies PLP, a slice funds the hedge premium.
  const hedgeBudget = Math.max(1, Math.round(deposit * (hedgeRatio / 100) * 0.5));
  const supplyBudget = Math.max(0, deposit - hedgeBudget);

  const runVault = async () => {
    if (!account) { setStatus('error'); setMessage('Connect your wallet first.'); return; }
    if (deposit <= 0) { setStatus('error'); setMessage('Enter a deposit amount.'); return; }
    setStatus('pending'); setMessage('Checking your DUSDC…');

    const coin = await findDusdcCoin(client, account.address);
    if (!coin) { setStatus('error'); setMessage('No DUSDC found. Request testnet tokens first.'); return; }
    if (coin.balance < deposit) { setStatus('error'); setMessage(`Need $${deposit} DUSDC. You have ${coin.balance.toFixed(2)}.`); return; }

    try {
      const oracle = await getActiveOracle();
      if (!oracle) { setStatus('error'); setMessage('No live oracle for the hedge right now — try again shortly.'); return; }

      let managerId = await findManager(client, account.address);
      if (!managerId) {
        setMessage('Creating your trading account…');
        const createTx = buildCreateManagerTx(account.address);
        const createBytes = await createTx.build({ client });
        const createRes: any = await new Promise((resolve, reject) => {
          signAndExecute({ transaction: toBase64(createBytes) }, { onSuccess: r => resolve(r), onError: e => reject(e) });
        });
        if (createRes?.digest) {
          try { const full = await client.waitForTransaction({ digest: createRes.digest, options: { showObjectChanges: true } }); managerId = managerIdFromEffects(full); } catch {}
        }
        if (!managerId) { await new Promise(r => setTimeout(r, 1500)); managerId = await findManager(client, account.address); }
        if (!managerId) { setStatus('error'); setMessage('Account created — tap again to deploy the vault position.'); return; }
      }

      setMessage('Supplying to PLP and minting your hedge…');
      const tx = buildSupplyHedgeTx({
        sender: account.address,
        managerId,
        oracleId: oracle.oracleId,
        strike: BigInt(oracle.strike),
        expiry: BigInt(oracle.expiry),
        dusdcCoinId: coin.id,
        supplyAmount: supplyBudget,
        hedgeAmount: hedgeBudget,
        hedgeQuantity: BigInt(Math.round(hedgeBudget * 1e6)),
      });
      const bytes = await tx.build({ client });
      signAndExecute({ transaction: toBase64(bytes) }, {
        onSuccess: (res) => { setStatus('success'); setTxDigest(res.digest); setMessage(`Vault position live. Supplied $${supplyBudget} to PLP and minted $${hedgeBudget} of downside protection — in one transaction.`); },
        onError: (e) => {
          const m = e.message || '';
          if (m.includes('assert_key_matches') || m.includes('abort code: 1')) { setStatus('error'); setMessage('The hedge oracle just rolled over. Try again in a moment.'); }
          else { setStatus('error'); setMessage(m || 'Transaction failed.'); }
        },
      });
    } catch (e: any) { setStatus('error'); setMessage(e?.message || 'Failed to build transaction.'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '12px' }}>STRUCTURED VAULT</div>
        <h1 style={{ fontSize: '44px', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, marginBottom: '16px' }}>
          PLP yield,<br />with a seatbelt.
        </h1>
        <p style={{ fontSize: '17px', color: 'var(--muted2)', lineHeight: 1.6, maxWidth: '620px', marginBottom: '32px' }}>
          Raw PLP earns the house's edge but eats the full left tail in a crash. The APEX PLP+Hedge vault supplies to PLP and spends a slice of the yield on out-of-the-money insurance — so you keep most of the upside and cap the downside. The product LPs actually want: <span style={{ color: 'var(--lime)', fontWeight: 700 }}>yield minus crash insurance.</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
          {/* Controls */}
          <div>
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '20px' }}>STRATEGY DESIGNER</h3>

              {/* Deposit */}
              <label style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Deposit (DUSDC)</label>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: 700, color: 'var(--muted)' }}>$</span>
                <input type="number" min="0" value={deposit} onChange={e => setDeposit(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '13px 14px 13px 30px', borderRadius: '11px', border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '17px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Hedge ratio */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600 }}>Hedge ratio (yield spent on insurance)</label>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--lime)' }}>{hedgeRatio}%</span>
              </div>
              <input type="range" min="0" max="80" value={hedgeRatio} onChange={e => setHedgeRatio(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#C8FF00', cursor: 'pointer', marginBottom: '24px' }} />

              {/* Crash protection */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600 }}>Crash protection (% of deposit shielded)</label>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--green)' }}>{crashProtection}%</span>
              </div>
              <input type="range" min="0" max="40" value={crashProtection} onChange={e => setCrashProtection(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#00FF87', cursor: 'pointer' }} />
            </div>

            {/* Crash comparison */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '18px' }}>TAIL-CRASH COMPARISON</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>Raw PLP (no hedge)</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--red)' }}>−${r.worstCaseNoHedge.toFixed(0)}</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg2)', borderRadius: '7px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'var(--red)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>APEX PLP+Hedge</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--green)' }}>−${r.worstCaseLoss.toFixed(0)}</span>
                  </div>
                  <div style={{ height: '14px', background: 'var(--bg2)', borderRadius: '7px', overflow: 'hidden' }}>
                    <div style={{ width: `${r.worstCaseNoHedge > 0 ? (r.worstCaseLoss / r.worstCaseNoHedge) * 100 : 0}%`, height: '100%', background: 'var(--green)' }} />
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '16px', lineHeight: 1.5 }}>
                Modeled against a ~40% tail drawdown on raw PLP. The hedge reimburses the protected fraction, cutting worst-case loss by ${(r.worstCaseNoHedge - r.worstCaseLoss).toFixed(0)}.
              </p>
            </div>
          </div>

          {/* Results panel */}
          <div style={{ position: 'sticky', top: '88px' }}>
            <div style={{ background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border2)', padding: '26px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>NET APY</div>
              <div style={{ fontSize: '46px', fontWeight: 900, color: 'var(--lime)', letterSpacing: '-2px', lineHeight: 1, marginBottom: '4px' }}>
                {r.netApy.toFixed(1)}%
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '22px' }}>after insurance cost</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
                {[
                  { l: 'Gross PLP yield', v: `$${r.grossYield.toFixed(0)}`, c: 'var(--text)' },
                  { l: 'Insurance cost', v: `−$${r.hedgeCost.toFixed(0)}`, c: 'var(--red)' },
                  { l: 'Net yield / yr', v: `$${r.netYield.toFixed(0)}`, c: 'var(--green)' },
                  { l: 'Protected in crash', v: `$${r.protectedAmount.toFixed(0)}`, c: 'var(--lime)' },
                ].map(row => (
                  <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>{row.l}</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>

              <button onClick={runVault} disabled={status === 'pending'} style={{ display: 'block', width: '100%', padding: '15px', borderRadius: '12px', background: status === 'pending' ? 'var(--bg3)' : 'var(--lime)', color: status === 'pending' ? 'var(--muted2)' : '#000', border: 'none', fontSize: '16px', fontWeight: 800, textAlign: 'center', cursor: status === 'pending' ? 'not-allowed' : 'pointer', boxShadow: status === 'pending' ? 'none' : '0 0 30px rgba(200,255,0,0.3)' }}>
                {status === 'pending' ? 'Deploying…' : account ? 'Deploy vault position →' : 'Connect wallet'}
              </button>

              {message && (
                <div style={{ marginTop: '12px', padding: '11px', borderRadius: '10px', fontSize: '12.5px', lineHeight: 1.5,
                  background: status === 'success' ? 'var(--green-dim)' : status === 'error' ? 'var(--red-dim)' : 'var(--bg2)',
                  color: status === 'success' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--muted2)',
                  border: `1px solid ${status === 'success' ? 'rgba(0,255,135,0.3)' : status === 'error' ? 'rgba(255,59,59,0.3)' : 'var(--border)'}` }}>
                  {message}
                  {txDigest && (
                    <a href={`https://suiscan.xyz/testnet/tx/${txDigest}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '6px', color: 'var(--lime)', fontWeight: 700 }}>View on Suiscan →</a>
                  )}
                </div>
              )}

              <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
                One atomic transaction: ${supplyBudget} supplied to PLP + ${hedgeBudget} downside hedge. Base APY from live share price{sharePrice ? ` ($${sharePrice.toFixed(4)})` : ''}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}