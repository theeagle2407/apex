'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { PREDICT_PACKAGE } from '@/lib/constants';

interface TxRow {
  digest: string;
  action: string;
  time: string;
  status: string;
}

// Reads the user's real on-chain transactions that touched the Predict package
// and renders them as a clean activity feed.
export default function TxHistory() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await client.queryTransactionBlocks({
          filter: { FromAddress: account.address },
          options: { showInput: true, showEffects: true },
          limit: 25,
          order: 'descending',
        });

        const parsed: TxRow[] = [];
        for (const tx of res.data || []) {
          const txData: any = tx.transaction?.data?.transaction;
          let touchesPredict = false;
          let action = 'Transaction';

          // Inspect ProgrammableTransaction commands for predict moveCalls
          const cmds = txData?.transactions || [];
          for (const c of cmds) {
            const mc = c?.MoveCall;
            if (mc && typeof mc.package === 'string' && mc.package.includes(PREDICT_PACKAGE.slice(2, 10))) {
              touchesPredict = true;
              if (mc.function === 'supply') action = 'Supplied liquidity';
              else if (mc.function === 'withdraw') action = 'Withdrew liquidity';
              else if (mc.function === 'mint') action = 'Minted position';
              else if (mc.function === 'create_manager') action = 'Created account';
              else action = mc.function || 'Predict action';
            }
          }

          if (!touchesPredict) continue;

          const ts = tx.timestampMs ? Number(tx.timestampMs) : null;
          parsed.push({
            digest: tx.digest,
            action,
            time: ts ? new Date(ts).toLocaleString() : '',
            status: tx.effects?.status?.status === 'success' ? 'success' : 'failed',
          });
        }
        setRows(parsed);
      } catch (e) {
        console.error('tx history error', e);
      }
      setLoading(false);
    })();
  }, [account, client]);

  if (!account) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted2)', letterSpacing: '1px', marginBottom: '18px' }}>ACTIVITY</h3>
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading your on-chain activity...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No APEX transactions yet. Supply liquidity or take a position to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map(r => (
            <a
              key={r.digest}
              href={'https://suiscan.xyz/testnet/tx/' + r.digest}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg2)', borderRadius: '10px', transition: 'background 0.15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.status === 'success' ? 'var(--green)' : 'var(--red)' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{r.action}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.time}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted2)', fontFamily: 'monospace' }}>
                {r.digest.slice(0, 8)}...
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}