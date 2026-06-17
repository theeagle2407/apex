'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { toBase64 } from '@mysten/sui/utils';
import { getMyManagerAccount, getManagerPositions } from '@/lib/api';
import { buildRedeemTx, buildManagerWithdrawTx } from '@/lib/trade';

export default function Positions() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [acct, setAcct] = useState<any>(null);
  const [managerId, setManagerId] = useState<string>('');
  const [positions, setPositions] = useState<any[]>([]);
  const [redeemedKeys, setRedeemedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const posKey = (p: any) => `${p.oracle_id}-${p.expiry}-${p.strike}-${p.is_up}`;

  const load = async () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await getMyManagerAccount(account.address);
      if (r) {
        setAcct(r.summary); setManagerId(r.managerId);
        const pos = await getManagerPositions(r.managerId);
        setPositions(pos.minted);
        setRedeemedKeys(new Set(pos.redeemed.map(posKey)));
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [account]);

  const d = (n: number) => Number(n) / 1e6;

  const claim = async (p: any) => {
    if (!account || !managerId) return;
    setBusy(true); setMsg('Claiming your winnings…');
    try {
      const tx = buildRedeemTx({
        sender: account.address,
        managerId,
        oracleId: p.oracle_id,
        strike: BigInt(p.strike),
        expiry: BigInt(p.expiry),
        side: p.is_up ? 'yes' : 'no',
        quantity: BigInt(p.quantity),
      });
      const bytes = await tx.build({ client });
      signAndExecute({ transaction: toBase64(bytes) }, {
        onSuccess: () => { setMsg('Claimed! Your winnings moved to your free balance — withdraw below.'); setBusy(false); setTimeout(load, 1800); },
        onError: (e) => { setMsg(e.message || 'Claim failed.'); setBusy(false); },
      });
    } catch (e: any) { setMsg(e.message || 'Failed.'); setBusy(false); }
  };

  const withdraw = async () => {
    if (!account || !managerId || !acct) return;
    const bal = Number(acct.trading_balance || 0);
    if (bal <= 0) { setMsg('No free balance to withdraw.'); return; }
    setBusy(true); setMsg('Withdrawing to your wallet…');
    try {
      const tx = buildManagerWithdrawTx({ sender: account.address, managerId, amount: BigInt(bal) });
      const bytes = await tx.build({ client });
      signAndExecute({ transaction: toBase64(bytes) }, {
        onSuccess: () => { setMsg('Withdrawn to your wallet.'); setBusy(false); setTimeout(load, 1800); },
        onError: (e) => { setMsg(e.message || 'Withdraw failed.'); setBusy(false); },
      });
    } catch (e: any) { setMsg(e.message || 'Failed.'); setBusy(false); }
  };

  if (!account) return null;

  const hasRedeemable = acct && Number(acct.redeemable_value) > 0;
  const hasFreeBalance = acct && Number(acct.trading_balance) > 0;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px' }}>PREDICTION POSITIONS</h3>
        {acct && <button onClick={load} style={{ fontSize: '12px', color: 'var(--lime)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Refresh</button>}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading your on-chain account…</p>
      ) : !acct ? (
        <p style={{ color: 'var(--muted2)', fontSize: '14px', lineHeight: 1.6 }}>No trading account yet. Take a position on a market to open one.</p>
      ) : (
        <>
          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '18px' }}>
            {[
              { l: 'Open positions', v: String(acct.open_positions ?? 0) },
              { l: 'Open exposure', v: `$${d(acct.open_exposure || 0).toFixed(2)}` },
              { l: 'Unrealized PnL', v: `${acct.unrealized_pnl >= 0 ? '+' : ''}$${d(acct.unrealized_pnl || 0).toFixed(2)}`, c: acct.unrealized_pnl > 0 ? 'var(--green)' : acct.unrealized_pnl < 0 ? 'var(--red)' : 'var(--text)' },
              { l: 'Realized PnL', v: `${acct.realized_pnl >= 0 ? '+' : ''}$${d(acct.realized_pnl || 0).toFixed(2)}`, c: acct.realized_pnl > 0 ? 'var(--green)' : acct.realized_pnl < 0 ? 'var(--red)' : 'var(--text)' },
            ].map(s => (
              <div key={s.l} style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>{s.l}</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: (s as any).c || 'var(--text)' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Individual positions with claim */}
          {positions.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>YOUR POSITIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {positions.map((p, i) => {
                  const settled = Date.now() > Number(p.expiry);
                  const claimed = redeemedKeys.has(posKey(p));
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--bg2)', borderRadius: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', background: p.is_up ? 'var(--green-dim)' : 'var(--red-dim)', color: p.is_up ? 'var(--green)' : 'var(--red)' }}>
                            BTC {p.is_up ? 'UP' : 'DOWN'}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>${(Number(p.strike) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })} strike</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          Cost ${d(p.cost).toFixed(2)} · {settled ? 'Settled' : `Settles ${new Date(Number(p.expiry)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </div>
                      {claimed ? (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Claimed</span>
                      ) : settled ? (
                        <button onClick={() => claim(p)} disabled={busy} style={{ padding: '9px 16px', borderRadius: '9px', background: busy ? 'var(--bg3)' : 'var(--lime)', color: busy ? 'var(--muted2)' : '#000', border: 'none', fontSize: '13px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
                          {busy ? '…' : 'Claim'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700 }}>Open</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Redeemable summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: hasRedeemable ? 'var(--green-dim)' : 'var(--bg2)', borderRadius: '11px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 600 }}>Redeemable winnings</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: hasRedeemable ? 'var(--green)' : 'var(--muted)' }}>${d(acct.redeemable_value || 0).toFixed(2)}</div>
            </div>
            {hasRedeemable && <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700 }}>Claim a settled position above</span>}
          </div>

          {/* Free balance + withdraw */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg2)', borderRadius: '11px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 600 }}>Free trading balance</div>
              <div style={{ fontSize: '20px', fontWeight: 900 }}>${d(acct.trading_balance || 0).toFixed(2)}</div>
            </div>
            {hasFreeBalance && (
              <button onClick={withdraw} disabled={busy} style={{ padding: '10px 18px', borderRadius: '10px', background: busy ? 'var(--bg3)' : 'var(--lime)', color: busy ? 'var(--muted2)' : '#000', border: 'none', fontSize: '13px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? '…' : 'Withdraw'}
              </button>
            )}
          </div>

          {msg && <p style={{ fontSize: '12px', color: 'var(--muted2)', marginTop: '12px' }}>{msg}</p>}

          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.5 }}>
            Live from your PredictManager on Sui testnet. Settled positions can be claimed; claimed winnings move to your free balance, which you withdraw to your wallet.
          </p>
        </>
      )}
    </div>
  );
}