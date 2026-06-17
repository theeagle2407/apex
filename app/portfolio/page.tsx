'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import Header from '@/components/Header';
import RollingNumber from '@/components/RollingNumber';
import { PLP_TYPE, DUSDC_TYPE } from '@/lib/constants';
import TxHistory from '@/components/TxHistory';
import Positions from '@/components/Positions';

export default function PortfolioPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [plpBalance, setPlpBalance] = useState<number | null>(null);
  const [dusdcBalance, setDusdcBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [plp, dusdc] = await Promise.all([
          client.getBalance({ owner: account.address, coinType: PLP_TYPE }).catch(() => null),
          client.getBalance({ owner: account.address, coinType: DUSDC_TYPE }).catch(() => null),
        ]);
        if (plp) setPlpBalance(Number(plp.totalBalance) / 1e6);
        else setPlpBalance(0);
        if (dusdc) setDusdcBalance(Number(dusdc.totalBalance) / 1e6);
        else setDusdcBalance(0);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [account, client]);

  if (!account) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '120px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>◇</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px' }}>Connect your wallet</h2>
          <p style={{ color: 'var(--muted2)', marginBottom: '24px' }}>See your positions and vault holdings.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '10px' }}>PORTFOLIO</div>
          <h1 style={{ fontSize: '40px', fontWeight: 900, letterSpacing: '-1.5px' }}>Your holdings</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px', fontFamily: 'monospace' }}>{account.address}</p>
        </div>

        {/* Balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>DUSDC BALANCE</div>
            <div style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-1px' }}>
              {dusdcBalance !== null ? <RollingNumber value={dusdcBalance} prefix="$" decimals={2} /> : '—'}
            </div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>PLP SHARES</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--lime)', letterSpacing: '-1px' }}>
              {plpBalance !== null ? <RollingNumber value={plpBalance} decimals={4} /> : '—'}
            </div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>VAULT POSITION</div>
            <div style={{ fontSize: '30px', fontWeight: 900, color: plpBalance ? 'var(--green)' : 'var(--muted)', letterSpacing: '-1px' }}>
              {plpBalance !== null ? (plpBalance > 0 ? 'Active' : 'None') : '—'}
            </div>
          </div>
        </div>

        {/* Vault holding detail */}
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '18px' }}>LIQUIDITY POSITION</h3>
          {loading ? (
            <p style={{ color: 'var(--muted)' }}>Loading your on-chain holdings…</p>
          ) : plpBalance && plpBalance > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', background: 'var(--bg2)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--lime-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🏦</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>DeepBook Vault LP</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted2)' }}>PLP shares · earns from all market flow</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--lime)' }}>{plpBalance.toFixed(4)} PLP</div>
                <Link href="/vault" style={{ fontSize: '12px', color: 'var(--muted2)' }}>Manage →</Link>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <p style={{ color: 'var(--muted2)', marginBottom: '16px' }}>You have no vault position yet.</p>
              <Link href="/vault" style={{ padding: '10px 22px', background: 'var(--lime)', color: '#000', borderRadius: '10px', fontSize: '14px', fontWeight: 800, display: 'inline-block' }}>
                Supply liquidity →
              </Link>
            </div>
          )}
        </div>

        {/* Live prediction positions from the user's PredictManager */}
        <Positions />

        {/* Transaction history */}
        <div style={{ marginTop: '16px' }}>
          <TxHistory />
        </div>
      </div>
    </div>
  );
}