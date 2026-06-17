'use client';

import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { toBase64 } from '@mysten/sui/utils';
import { getSoonestOracle } from '@/lib/api';
import { buildMintTx, buildCreateManagerTx, findDusdcCoin, findManager, managerIdFromEffects } from '@/lib/trade';

export default function LiveRound() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [oracle, setOracle] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('1');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [txDigest, setTxDigest] = useState('');
  const timer = useRef<any>(null);

  const loadOracle = () => getSoonestOracle().then(setOracle).catch(() => {});

  useEffect(() => {
    loadOracle();
    timer.current = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(loadOracle, 30000);
    return () => { clearInterval(timer.current); clearInterval(refresh); };
  }, []);

  const secsLeft = oracle ? Math.max(0, Math.floor((oracle.expiry - now) / 1000)) : 0;
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');
  const expired = oracle && secsLeft === 0;

  const amt = parseFloat(amount) || 0;

  const handleMint = async () => {
    if (!account) { setMessage('Connect your wallet first'); setStatus('error'); return; }
    if (!oracle) { setMessage('No live round right now — a new one spins up shortly.'); setStatus('error'); return; }
    if (amt <= 0) { setMessage('Enter an amount'); setStatus('error'); return; }

    setStatus('pending');
    setMessage('Checking your DUSDC…');
    const coin = await findDusdcCoin(client, account.address);
    if (!coin) { setStatus('error'); setMessage('No DUSDC found. Request testnet tokens first.'); return; }
    if (coin.balance < Math.max(amt, 2)) { setStatus('error'); setMessage(`Need at least $2 DUSDC to cover premium. You have ${coin.balance.toFixed(2)}.`); return; }

    try {
      let managerId = await findManager(client, account.address);
      if (!managerId) {
        setMessage('Creating your trading account…');
        const createTx = buildCreateManagerTx(account.address);
        const createBytes = await createTx.build({ client });
        const createRes: any = await new Promise((resolve, reject) => {
          signAndExecute({ transaction: toBase64(createBytes) }, { onSuccess: (r) => resolve(r), onError: (e) => reject(e) });
        });
        if (createRes?.digest) {
          try {
            const full = await client.waitForTransaction({ digest: createRes.digest, options: { showObjectChanges: true } });
            managerId = managerIdFromEffects(full);
          } catch {}
        }
        if (!managerId) { await new Promise(r => setTimeout(r, 1500)); managerId = await findManager(client, account.address); }
        if (!managerId) { setStatus('error'); setMessage('Account created — tap again to place your position.'); return; }
      }

      setMessage('Building your position…');
      const tx = buildMintTx({
        sender: account.address,
        managerId,
        oracleId: oracle.oracleId,
        strike: BigInt(oracle.strike),
        expiry: BigInt(oracle.expiry),
        side,
        depositAmount: Math.max(amt, 2),
        quantity: BigInt(Math.round(amt * 1e6)),
        dusdcCoinId: coin.id,
      });
      const bytes = await tx.build({ client });

      signAndExecute({ transaction: toBase64(bytes) }, {
        onSuccess: (result) => {
          setStatus('success');
          setTxDigest(result.digest);
          setMessage(`Position minted on the live round! ${side.toUpperCase()} · $${amt}. It settles automatically when the round expires.`);
        },
        onError: (err) => {
          const msg = err.message || '';
          if (msg.includes('assert_key_matches') || msg.includes('abort code: 1')) {
            setStatus('idle');
            setMessage('This round just rolled over — fetching the next one. Try again in a moment.');
            loadOracle();
          } else { setStatus('error'); setMessage(msg || 'Transaction failed.'); }
        },
      });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('assert_key_matches') || msg.includes('abort code: 1') || msg.includes('MoveAbort')) {
        setStatus('idle'); setMessage('This round just rolled over — fetching the next one. Try again in a moment.'); loadOracle();
      } else { setStatus('error'); setMessage(msg || 'Failed to build transaction'); }
    }
  };

  return (
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '12px' }}>LIVE ROUND</div>
        <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '10px' }}>Will BTC be up at the bell?</h1>
        <p style={{ fontSize: '16px', color: 'var(--muted2)', lineHeight: 1.6, marginBottom: '28px' }}>
          A real sub-hour DeepBook Predict round on live BTC. Take a side before the clock runs out — it settles on-chain automatically at expiry.
        </p>

        {!oracle ? (
          <p style={{ color: 'var(--muted)' }}>Finding the live round…</p>
        ) : (
          <>
            {/* Countdown */}
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>
                {expired ? 'ROUND CLOSED — SETTLING' : 'TIME TO SETTLEMENT'}
              </div>
              <div style={{ fontSize: '64px', fontWeight: 900, color: expired ? 'var(--muted)' : 'var(--lime)', letterSpacing: '-3px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {mm}:{ss}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '18px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>BTC FORWARD</div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>${oracle.forward ? oracle.forward.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>STRIKE (ATM)</div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>${(Number(oracle.strike) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            </div>

            {/* Trade */}
            <div style={{ background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border2)', padding: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
                <button onClick={() => setSide('yes')} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: side === 'yes' ? 'var(--green-dim)' : 'transparent', border: `1.5px solid ${side === 'yes' ? 'var(--green)' : 'var(--border2)'}`, color: side === 'yes' ? 'var(--green)' : 'var(--muted2)', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>UP</button>
                <button onClick={() => setSide('no')} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: side === 'no' ? 'var(--red-dim)' : 'transparent', border: `1.5px solid ${side === 'no' ? 'var(--red)' : 'var(--border2)'}`, color: side === 'no' ? 'var(--red)' : 'var(--muted2)', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>DOWN</button>
              </div>

              <label style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Amount (DUSDC)</label>
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: 700, color: 'var(--muted)' }}>$</span>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '14px 14px 14px 30px', borderRadius: '11px', border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '18px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <button onClick={handleMint} disabled={status === 'pending' || expired} style={{
                width: '100%', padding: '15px', borderRadius: '12px',
                background: (status === 'pending' || expired) ? 'var(--bg3)' : 'var(--lime)',
                color: (status === 'pending' || expired) ? 'var(--muted2)' : '#000',
                border: 'none', fontSize: '16px', fontWeight: 800,
                cursor: (status === 'pending' || expired) ? 'not-allowed' : 'pointer',
                boxShadow: (status === 'pending' || expired) ? 'none' : '0 0 30px rgba(200,255,0,0.3)',
              }}>
                {expired ? 'Round closed' : status === 'pending' ? 'Processing…' : account ? `Take ${side === 'yes' ? 'UP' : 'DOWN'}` : 'Connect wallet'}
              </button>

              {message && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
                  background: status === 'success' ? 'var(--green-dim)' : status === 'error' ? 'var(--red-dim)' : 'var(--bg2)',
                  color: status === 'success' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--muted2)',
                  border: `1px solid ${status === 'success' ? 'rgba(0,255,135,0.3)' : status === 'error' ? 'rgba(255,59,59,0.3)' : 'var(--border)'}` }}>
                  {message}
                  {txDigest && (
                    <a href={`https://suiscan.xyz/testnet/tx/${txDigest}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '8px', color: 'var(--lime)', fontWeight: 700 }}>
                      View on Suiscan →
                    </a>
                  )}
                </div>
              )}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px' }}>
              Oracle {oracle.oracleId.slice(0, 10)}… · settles automatically on-chain at expiry
            </p>
          </>
        )}
      </div>
  );
}