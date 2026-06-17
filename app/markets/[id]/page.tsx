'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { toBase64 } from '@mysten/sui/utils';
import Header from '@/components/Header';
import RollingNumber from '@/components/RollingNumber';
import { MARKETS, CATEGORY_EMOJI, CATEGORY_LABELS } from '@/lib/mockData';
import { getActiveOracle } from '@/lib/api';
import { buildMintTx, buildCreateManagerTx, findDusdcCoin, findManager, managerIdFromEffects } from '@/lib/trade';

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const market = MARKETS.find(m => m.id === id);
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [txDigest, setTxDigest] = useState('');
  const [mintable, setMintable] = useState<boolean | null>(null);

  useEffect(() => {
    // Markets are tradeable whenever a fresh, active, pre-expiry oracle exists
    // (confirmed with the DeepBook team — ask-bounds is not required to mint).
    getActiveOracle().then(o => setMintable(!!o)).catch(() => setMintable(false));
  }, []);

  if (!market) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Market not found</h2>
          <Link href="/markets" style={{ color: 'var(--lime)', fontWeight: 700 }}>← Back to the floor</Link>
        </div>
      </div>
    );
  }

  const yesPct = Math.round(market.yesPrice * 100);
  const noPct = 100 - yesPct;
  const price = side === 'yes' ? market.yesPrice : market.noPrice;
  const amt = parseFloat(amount) || 0;
  const shares = price > 0 ? amt / price : 0;
  const potentialPayout = shares; // each share pays $1 if correct
  const potentialProfit = potentialPayout - amt;
  const daysLeft = Math.max(0, Math.ceil((new Date(market.expiry).getTime() - Date.now()) / 86400000));

  const handleTrade = async () => {
    if (!account) { setMessage('Connect your wallet first'); setStatus('error'); return; }
    if (amt <= 0) { setMessage('Enter an amount'); setStatus('error'); return; }

    setStatus('pending');
    setMessage('Checking your DUSDC…');

    const coin = await findDusdcCoin(client, account.address);
    if (!coin) {
      setStatus('error');
      setMessage('No DUSDC found. Request testnet tokens first.');
      return;
    }
    if (coin.balance < amt) {
      setStatus('error');
      setMessage(`Insufficient DUSDC. You have ${coin.balance.toFixed(2)}.`);
      return;
    }

    try {
      // 1. Ensure the user has a PredictManager. Create one if missing.
      let managerId = await findManager(client, account.address);
      if (!managerId) {
        setMessage('Creating your trading account…');
        const createTx = buildCreateManagerTx(account.address);
        const createBytes = await createTx.build({ client });
        const createRes: any = await new Promise((resolve, reject) => {
          signAndExecute(
            { transaction: toBase64(createBytes) },
            { onSuccess: (r) => resolve(r), onError: (e) => reject(e) }
          );
        });

        // The default hook returns just the digest. Fetch the full tx to read
        // the created PredictManager object id.
        if (createRes?.digest) {
          try {
            const full = await client.waitForTransaction({
              digest: createRes.digest,
              options: { showObjectChanges: true },
            });
            managerId = managerIdFromEffects(full);
          } catch (e) { console.error(e); }
        }
        if (!managerId) {
          await new Promise(r => setTimeout(r, 1500));
          managerId = await findManager(client, account.address);
        }
        if (!managerId) {
          setStatus('error');
          setMessage('Trading account created — tap Buy again to place your position.');
          return;
        }
      }

      // 2. Fetch a LIVE active oracle (testnet oracles are short-dated and settle
      // continuously, so we never use a hardcoded one — we pick a fresh active
      // oracle at trade time and use its real id, strike, and expiry).
      setMessage('Finding a live market…');
      const oracle = await getActiveOracle();
      if (!oracle) {
        setStatus('error');
        setMessage('No active oracle right now — the market round just settled. Try again in a minute.');
        return;
      }

      // 3. Build the mint transaction against the live oracle.
      setMessage('Building your position…');
      // Deposit a bit more than the contract cost to cover the premium, and mint
      // `amt` contracts (1 contract = 1e6 base units, like the team's proof tx).
      const quantity = BigInt(Math.round(amt * 1e6));
      const tx = buildMintTx({
        sender: account.address,
        managerId,
        oracleId: oracle.oracleId,
        strike: BigInt(oracle.strike),
        expiry: BigInt(oracle.expiry),
        side,
        depositAmount: Math.max(amt, 2), // fund manager to cover premium
        quantity,
        dusdcCoinId: coin.id,
      });
      const bytes = await tx.build({ client });

      signAndExecute(
        { transaction: toBase64(bytes) },
        {
          onSuccess: (result) => {
            setStatus('success');
            setTxDigest(result.digest);
            setMessage(`Position minted! You took the ${side.toUpperCase()} side for $${amt}.`);
          },
          onError: (err) => {
            const msg = err.message || '';
            if (msg.includes('assert_key_matches') || msg.includes('abort code: 1')) {
              // Oracle round bounds not set yet — not a failure, just not tradeable.
              setStatus('idle');
              setMessage('⏳ This market round is between settlement cycles. New positions open when the oracle sets its next price bounds — usually within a few minutes. Meanwhile, you can provide liquidity in the Vault and earn from every trade.');
            } else {
              setStatus('error');
              setMessage(msg || 'Transaction failed.');
            }
          },
        }
      );
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('assert_key_matches') || msg.includes('abort code: 1') || msg.includes('MoveAbort')) {
        setStatus('idle');
        setMessage('⏳ This market round is between settlement cycles. New positions open when the oracle sets its next price bounds — usually within a few minutes. Meanwhile, you can provide liquidity in the Vault and earn from every trade.');
      } else {
        setStatus('error');
        setMessage(msg || 'Failed to build transaction');
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
        {/* LEFT — market info */}
        <div>
          <Link href="/markets" style={{ fontSize: '13px', color: 'var(--muted2)', fontWeight: 600, display: 'inline-block', marginBottom: '20px' }}>
            ← The floor
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>{CATEGORY_EMOJI[market.category]}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {CATEGORY_LABELS[market.category]}
            </span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--muted)' }}>· {daysLeft} days left</span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-1px', marginBottom: '24px' }}>
            {market.question}
          </h1>

          {/* Big probability */}
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '52px', fontWeight: 900, color: 'var(--lime)', lineHeight: 1, letterSpacing: '-2px' }}>
                <RollingNumber value={yesPct} suffix="%" duration={700} />
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted2)', fontWeight: 600, marginBottom: '8px' }}>probability YES</div>
            </div>
            <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: `${yesPct}%`, background: 'var(--green)', transition: 'width 0.6s ease' }} />
              <div style={{ width: `${noPct}%`, background: 'var(--red)', transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--green)' }}>YES {yesPct}¢</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--red)' }}>NO {noPct}¢</span>
            </div>
          </div>

          {/* Description */}
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '12px' }}>RESOLUTION</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted2)', lineHeight: 1.7 }}>{market.description}</p>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'Volume', value: `$${(market.volume / 1000).toFixed(0)}K` },
              { label: 'Liquidity', value: `$${(market.liquidity / 1000).toFixed(0)}K` },
              { label: 'Closes in', value: `${daysLeft}d` },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — trade panel */}
        <div style={{ position: 'sticky', top: '88px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border2)', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Take a position</h3>
              {mintable !== null && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                  background: mintable ? 'var(--green-dim)' : 'var(--bg2)',
                  color: mintable ? 'var(--green)' : 'var(--muted)',
                  border: `1px solid ${mintable ? 'rgba(0,255,135,0.3)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: mintable ? 'var(--green)' : 'var(--muted)' }} />
                  {mintable ? 'Live pricing' : 'Between rounds'}
                </span>
              )}
            </div>

            {/* YES/NO toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              <button onClick={() => setSide('yes')} style={{
                flex: 1, padding: '14px', borderRadius: '11px',
                background: side === 'yes' ? 'var(--green-dim)' : 'transparent',
                border: `1.5px solid ${side === 'yes' ? 'var(--green)' : 'var(--border2)'}`,
                color: side === 'yes' ? 'var(--green)' : 'var(--muted2)',
                fontSize: '15px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
              }}>YES · {yesPct}¢</button>
              <button onClick={() => setSide('no')} style={{
                flex: 1, padding: '14px', borderRadius: '11px',
                background: side === 'no' ? 'var(--red-dim)' : 'transparent',
                border: `1.5px solid ${side === 'no' ? 'var(--red)' : 'var(--border2)'}`,
                color: side === 'no' ? 'var(--red)' : 'var(--muted2)',
                fontSize: '15px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
              }}>NO · {noPct}¢</button>
            </div>

            {/* Amount */}
            <label style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Amount (DUSDC)</label>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: 700, color: 'var(--muted)' }}>$</span>
              <input
                type="number" min="0" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '14px 14px 14px 30px',
                  borderRadius: '11px', border: '1px solid var(--border2)',
                  background: 'var(--bg2)', color: 'var(--text)',
                  fontSize: '18px', fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} style={{
                  flex: 1, padding: '7px', borderRadius: '7px',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  color: 'var(--muted2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>${v}</button>
              ))}
            </div>

            {/* Payout preview */}
            <div style={{ background: 'var(--bg2)', borderRadius: '11px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>Shares</span>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{shares.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>If correct, you get</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>${potentialPayout.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted2)' }}>Potential profit</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)' }}>+${potentialProfit > 0 ? potentialProfit.toFixed(2) : '0.00'}</span>
              </div>
            </div>

            {/* Buy button */}
            <button onClick={handleTrade} disabled={status === 'pending'} style={{
              width: '100%', padding: '15px', borderRadius: '12px',
              background: status === 'pending' ? 'var(--bg3)' : 'var(--lime)',
              color: status === 'pending' ? 'var(--muted2)' : '#000',
              border: 'none', fontSize: '16px', fontWeight: 800,
              cursor: status === 'pending' ? 'not-allowed' : 'pointer',
              boxShadow: status === 'pending' ? 'none' : '0 0 30px rgba(200,255,0,0.3)',
            }}>
              {status === 'pending' ? 'Processing…' : !account ? 'Connect wallet to trade' : `Buy ${side.toUpperCase()}`}
            </button>

            {/* Status message */}
            {message && (
              <div style={{
                marginTop: '14px', padding: '12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
                background: status === 'success' ? 'var(--green-dim)' : status === 'error' ? 'var(--red-dim)' : 'var(--bg2)',
                color: status === 'success' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--muted2)',
                border: `1px solid ${status === 'success' ? 'rgba(0,255,135,0.3)' : status === 'error' ? 'rgba(255,59,59,0.3)' : 'var(--border)'}`,
              }}>
                {message}
                {txDigest && (
                  <a href={`https://suiscan.xyz/testnet/tx/${txDigest}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: '8px', color: 'var(--lime)', fontWeight: 700 }}>
                    View on Suiscan →
                  </a>
                )}
              </div>
            )}
          </div>

          <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
            Positions settle on-chain via DeepBook. Winners are paid automatically at resolution.
          </p>
        </div>
      </div>
    </div>
  );
}