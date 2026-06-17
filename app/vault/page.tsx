'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { toBase64 } from '@mysten/sui/utils';
import Header from '@/components/Header';
import RollingNumber from '@/components/RollingNumber';
import { buildSupplyTx, buildWithdrawTx, findDusdcCoin, findPlpCoin } from '@/lib/trade';
import { getVaultSummary } from '@/lib/api';

export default function VaultPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [txDigest, setTxDigest] = useState('');
  const [vaultTvl, setVaultTvl] = useState<number | null>(null);
  const [sharePrice, setSharePrice] = useState<number | null>(null);
  const [availableLiq, setAvailableLiq] = useState<number | null>(null);
  const [dusdcBalance, setDusdcBalance] = useState<number | null>(null);
  const [plpBalance, setPlpBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<'supply' | 'withdraw'>('supply');

  useEffect(() => {
    getVaultSummary().then(v => {
      if (v && typeof v === 'object') {
        if (typeof v.vault_value === 'number') setVaultTvl(v.vault_value / 1e6);
        if (typeof v.plp_share_price === 'number') setSharePrice(v.plp_share_price);
        if (typeof v.available_liquidity === 'number') setAvailableLiq(v.available_liquidity / 1e6);
      }
    });
  }, []);

  useEffect(() => {
    if (account) {
      findDusdcCoin(client, account.address).then(c => setDusdcBalance(c ? c.balance : 0));
      findPlpCoin(client, account.address).then(c => setPlpBalance(c ? Number(c.balance) / 1e6 : 0));
    }
  }, [account, client]);

  const amt = parseFloat(amount) || 0;

  const refresh = () => {
    if (!account) return;
    findDusdcCoin(client, account.address).then(c => setDusdcBalance(c ? c.balance : 0));
    findPlpCoin(client, account.address).then(c => setPlpBalance(c ? Number(c.balance) / 1e6 : 0));
  };

  const handleSupply = async () => {
    if (!account) { setMessage('Connect your wallet first'); setStatus('error'); return; }
    if (amt <= 0) { setMessage('Enter an amount'); setStatus('error'); return; }
    setStatus('pending');
    setMessage('Checking your DUSDC...');
    const coin = await findDusdcCoin(client, account.address);
    if (!coin) { setStatus('error'); setMessage('No DUSDC found. Request testnet tokens first.'); return; }
    if (coin.balance < amt) { setStatus('error'); setMessage('Insufficient DUSDC. You have ' + coin.balance.toFixed(2) + '.'); return; }
    try {
      setMessage('Building your deposit...');
      const tx = buildSupplyTx({ sender: account.address, amount: amt, dusdcCoinId: coin.id });
      const bytes = await tx.build({ client });
      signAndExecute(
        { transaction: toBase64(bytes) },
        {
          onSuccess: (result) => {
            setStatus('success');
            setTxDigest(result.digest);
            setMessage('Supplied $' + amt + ' DUSDC to the vault. You received PLP shares.');
            refresh();
          },
          onError: (err) => { setStatus('error'); setMessage(err.message || 'Transaction failed.'); },
        }
      );
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to build transaction');
    }
  };

  const handleWithdraw = async () => {
    if (!account) { setMessage('Connect your wallet first'); setStatus('error'); return; }
    if (amt <= 0) { setMessage('Enter an amount'); setStatus('error'); return; }
    setStatus('pending');
    setMessage('Checking your PLP shares...');
    const plp = await findPlpCoin(client, account.address);
    if (!plp || plp.balance === 0n) { setStatus('error'); setMessage('No PLP shares found. Supply liquidity first.'); return; }
    const plpHuman = Number(plp.balance) / 1e6;
    if (plpHuman < amt) { setStatus('error'); setMessage('Insufficient PLP. You have ' + plpHuman.toFixed(4) + '.'); return; }
    try {
      setMessage('Building your withdrawal...');
      const tx = buildWithdrawTx({ sender: account.address, plpCoinId: plp.id, plpAmount: BigInt(Math.round(amt * 1e6)) });
      const bytes = await tx.build({ client });
      signAndExecute(
        { transaction: toBase64(bytes) },
        {
          onSuccess: (result) => {
            setStatus('success');
            setTxDigest(result.digest);
            setMessage('Withdrew ' + amt + ' PLP shares back to DUSDC.');
            refresh();
          },
          onError: (err) => { setStatus('error'); setMessage(err.message || 'Withdrawal failed.'); },
        }
      );
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to build transaction');
    }
  };

  const handleAction = () => { if (mode === 'supply') { handleSupply(); } else { handleWithdraw(); } };

  const tabBtn = (m: 'supply' | 'withdraw', label: string) => (
    <button
      onClick={() => { setMode(m); setAmount(''); setMessage(''); setStatus('idle'); }}
      style={{
        flex: 1, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer',
        background: mode === m ? 'var(--lime)' : 'transparent',
        color: mode === m ? '#000' : 'var(--muted2)', fontSize: '13px', fontWeight: 800,
      }}
    >{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', letterSpacing: '2px', marginBottom: '12px' }}>LIQUIDITY VAULT</div>
          <h1 style={{ fontSize: '44px', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.05, marginBottom: '16px' }}>Earn yield as the house.</h1>
          <p style={{ fontSize: '17px', color: 'var(--muted2)', lineHeight: 1.6, maxWidth: '520px' }}>
            Supply DUSDC to the shared DeepBook vault and receive PLP shares. The vault earns from every trade on every market.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
          <div>
            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>TOTAL VALUE LOCKED</div>
              <div style={{ fontSize: '40px', fontWeight: 900, color: 'var(--lime)', letterSpacing: '-1.5px' }}>
                {vaultTvl !== null ? <RollingNumber value={vaultTvl} prefix="$" decimals={0} /> : '...'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
                {vaultTvl !== null ? 'Live from DeepBook vault' : 'Fetching live vault data...'}
              </div>

              {(sharePrice !== null || availableLiq !== null) && (
                <div style={{ display: 'flex', gap: '24px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                  {sharePrice !== null && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>PLP SHARE PRICE</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--green)' }}>${sharePrice.toFixed(4)}</div>
                    </div>
                  )}
                  {availableLiq !== null && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>AVAILABLE</div>
                      <div style={{ fontSize: '18px', fontWeight: 800 }}>${Math.round(availableLiq).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Your position */}
            {account && plpBalance !== null && (
              <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 700, letterSpacing: '1px', marginBottom: '14px' }}>YOUR POSITION</div>
                {plpBalance > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>PLP SHARES</div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--lime)', letterSpacing: '-1px' }}>{plpBalance.toFixed(4)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>VALUE</div>
                      <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>
                        ${sharePrice !== null ? (plpBalance * sharePrice).toFixed(2) : plpBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: 'var(--muted2)', lineHeight: 1.6 }}>
                    You have no liquidity in the vault yet. Supply DUSDC to start earning a share of every market's flow.
                  </p>
                )}
              </div>
            )}

            <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '16px' }}>HOW IT WORKS</h3>
              {[
                { n: '01', t: 'Supply DUSDC', d: 'Deposit stablecoins into the shared vault and receive PLP shares representing your portion.' },
                { n: '02', t: 'Vault backs every market', d: 'Your liquidity is the counterparty to traders across all prediction markets.' },
                { n: '03', t: 'Earn the spread', d: 'As traders mint and settle positions, the vault collects fees. PLP value grows over time.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--lime)', flexShrink: 0, width: '24px' }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{s.t}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted2)', lineHeight: 1.6 }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'sticky', top: '88px' }}>
            <div style={{ background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border2)', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>Liquidity</h3>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', background: 'var(--bg2)', padding: '4px', borderRadius: '10px' }}>
                {tabBtn('supply', 'Supply')}
                {tabBtn('withdraw', 'Withdraw')}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--muted2)', fontWeight: 600 }}>Amount ({mode === 'supply' ? 'DUSDC' : 'PLP'})</label>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {mode === 'supply'
                    ? (dusdcBalance !== null ? 'Balance: ' + dusdcBalance.toFixed(2) : '')
                    : (plpBalance !== null ? 'Shares: ' + plpBalance.toFixed(4) : '')}
                </span>
              </div>

              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', fontWeight: 700, color: 'var(--muted)' }}>$</span>
                <input
                  type="number" min="0" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '14px 14px 14px 30px', borderRadius: '11px', border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: '18px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                {[10, 50, 100].map(v => (
                  <button key={v} onClick={() => setAmount(String(v))} style={{ flex: 1, padding: '7px', borderRadius: '7px', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>${v}</button>
                ))}
                <button
                  onClick={() => {
                    if (mode === 'supply' && dusdcBalance) setAmount(String(Math.floor(dusdcBalance)));
                    else if (mode === 'withdraw' && plpBalance) setAmount(String(plpBalance));
                  }}
                  style={{ flex: 1, padding: '7px', borderRadius: '7px', background: 'var(--lime-dim)', border: '1px solid rgba(200,255,0,0.3)', color: 'var(--lime)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >Max</button>
              </div>

              <button
                onClick={handleAction}
                disabled={status === 'pending'}
                style={{ width: '100%', padding: '15px', borderRadius: '12px', background: status === 'pending' ? 'var(--bg3)' : 'var(--lime)', color: status === 'pending' ? 'var(--muted2)' : '#000', border: 'none', fontSize: '16px', fontWeight: 800, cursor: status === 'pending' ? 'not-allowed' : 'pointer', boxShadow: status === 'pending' ? 'none' : '0 0 30px rgba(200,255,0,0.3)' }}
              >
                {status === 'pending' ? 'Processing...' : account ? (mode === 'supply' ? 'Supply DUSDC' : 'Withdraw to DUSDC') : 'Connect wallet'}
              </button>

              {message && (
                <div style={{ marginTop: '14px', padding: '12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5, background: status === 'success' ? 'var(--green-dim)' : status === 'error' ? 'var(--red-dim)' : 'var(--bg2)', color: status === 'success' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--muted2)', border: '1px solid ' + (status === 'success' ? 'rgba(0,255,135,0.3)' : status === 'error' ? 'rgba(255,59,59,0.3)' : 'var(--border)') }}>
                  {message}
                  {txDigest && (
                    <a href={'https://suiscan.xyz/testnet/tx/' + txDigest} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '8px', color: 'var(--lime)', fontWeight: 700 }}>
                      View on Suiscan
                    </a>
                  )}
                </div>
              )}
            </div>

            <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
              PLP shares are redeemable for your portion of the vault, including accrued fees.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}