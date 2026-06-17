'use client';

import { useEffect, useState } from 'react';
import { getServerStatus, getMarketState, getVaultSummary, getOracles } from './api';

export interface LiveStats {
  serverOnline: boolean | null;
  vaultValue: number | null;
  marketCount: number | null;
  loading: boolean;
}

// Pulls real data from the DeepBook Predict public server.
// Any value that the server does not return stays null, and the UI hides it.
export function useStats(): LiveStats {
  const [stats, setStats] = useState<LiveStats>({
    serverOnline: null,
    vaultValue: null,
    marketCount: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    (async () => {
      const [status, vault, oracles] = await Promise.all([
        getServerStatus(),
        getVaultSummary(),
        getOracles(),
      ]);

      if (!active) return;

      // Parse vault value defensively — server shape may vary
      let vaultValue: number | null = null;
      if (vault && typeof vault === 'object') {
        const v = vault.totalValue ?? vault.total_value ?? vault.value ?? vault.tvl;
        if (typeof v === 'number') vaultValue = v;
        else if (typeof v === 'string' && !isNaN(Number(v))) vaultValue = Number(v);
      }

      // Count oracles/markets if the server returns a list
      let marketCount: number | null = null;
      if (Array.isArray(oracles)) marketCount = oracles.length;
      else if (oracles && Array.isArray(oracles.oracles)) marketCount = oracles.oracles.length;

      setStats({
        serverOnline: status !== null,
        vaultValue,
        marketCount,
        loading: false,
      });
    })();

    return () => { active = false; };
  }, []);

  return stats;
}