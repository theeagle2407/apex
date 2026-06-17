import { PREDICT_SERVER, PREDICT_OBJECT } from './constants';

// Generic fetch wrapper for the DeepBook Predict public server
async function predictFetch(path: string) {
  try {
    const res = await fetch(`${PREDICT_SERVER}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Predict server ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Predict API error:', path, err);
    return null;
  }
}

export async function getServerStatus() {
  return predictFetch('/status');
}

export async function getMarketState() {
  return predictFetch(`/predicts/${PREDICT_OBJECT}/state`);
}

export async function getOracles() {
  return predictFetch(`/predicts/${PREDICT_OBJECT}/oracles`);
}

export async function getOracleState(oracleId: string) {
  return predictFetch(`/oracles/${oracleId}/state`);
}

export async function getQuoteAssets() {
  return predictFetch(`/predicts/${PREDICT_OBJECT}/quote-assets`);
}

export async function getVaultSummary() {
  return predictFetch(`/predicts/${PREDICT_OBJECT}/vault/summary`);
}

export async function getVaultPerformance(range = 'ALL') {
  return predictFetch(`/predicts/${PREDICT_OBJECT}/vault/performance?range=${range}`);
}

export async function getManagerSummary(managerId: string) {
  return predictFetch(`/managers/${managerId}/summary`);
}

export async function getManagerPnl(managerId: string, range = 'ALL') {
  return predictFetch(`/managers/${managerId}/pnl?range=${range}`);
}

export async function getOraclePrices(oracleId: string) {
  return predictFetch(`/oracles/${oracleId}/prices`);
}

export async function getLatestPrice(oracleId: string) {
  return predictFetch(`/oracles/${oracleId}/prices/latest`);
}

export async function getTrades(oracleId: string) {
  return predictFetch(`/trades/${oracleId}`);
}

// Fetch the freshest ACTIVE oracle from the live grid. Oracles on testnet are
// short-dated and settle continuously, so we never hardcode — we pick a live one
// at trade time. Returns { oracleId, strike, expiry } or null.
export async function getActiveOracle(): Promise<{ oracleId: string; strike: string; expiry: string; forward: number } | null> {
  const data = await predictFetch(`/predicts/${PREDICT_OBJECT}/oracles`);
  if (!data) return null;
  const arr = Array.isArray(data) ? data : (data.oracles || []);
  const now = Date.now();
  // active + not yet expired, pick the one expiring soonest in the future
  const live = arr
    .filter((o: any) => o.status === 'active' && Number(o.expiry) > now)
    .sort((a: any, b: any) => Number(a.expiry) - Number(b.expiry));
  if (!live.length) return null;
  const o = live[0];

  // Fetch the oracle's live state to get the forward price, then snap an
  // at-the-money strike onto the tick grid (strike must be ATM or pricing aborts).
  let forward = 0;
  let strike = BigInt(o.min_strike ?? '50000000000000');
  try {
    const state = await predictFetch(`/oracles/${o.oracle_id}/state`);
    const fwd = state?.latest_price?.forward ?? state?.latest_price?.spot;
    const tick = BigInt(o.tick_size ?? '1000000000');
    const minStrike = BigInt(o.min_strike ?? '50000000000000');
    if (fwd) {
      forward = Number(fwd) / 1e9;
      const fwdBig = BigInt(Math.round(Number(fwd)));
      // snap to nearest grid point: min_strike + round((fwd-min)/tick)*tick
      const steps = (fwdBig - minStrike) / tick;
      strike = minStrike + steps * tick;
      if (strike < minStrike) strike = minStrike;
    }
  } catch { /* fall back to min_strike */ }

  return {
    oracleId: o.oracle_id,
    strike: strike.toString(),
    expiry: String(o.expiry),
    forward,
  };
}

// Fetch the latest SVI params + spot for an oracle (for the surface viewer).
export async function getOracleSvi(oracleId: string): Promise<any> {
  return predictFetch(`/oracles/${oracleId}/svi/latest`);
}

// List all active, unexpired oracles (for selectors).
export async function getActiveOracles(): Promise<any[]> {
  const data = await predictFetch(`/predicts/${PREDICT_OBJECT}/oracles`);
  if (!data) return [];
  const arr = Array.isArray(data) ? data : (data.oracles || []);
  const now = Date.now();
  return arr
    .filter((o: any) => o.status === 'active' && Number(o.expiry) > now)
    .sort((a: any, b: any) => Number(a.expiry) - Number(b.expiry));
}

// Fetch the list of PredictManagers (traders) for the leaderboard.
export async function getManagers(): Promise<any[]> {
  const data = await predictFetch(`/managers`);
  if (!data) return [];
  return Array.isArray(data) ? data : (data.managers || []);
}


// Total unique-owner trader count, for display.
export async function getTraderCount(): Promise<number> {
  const managers = await getManagers();
  const owners = new Set(managers.map((m: any) => m.owner).filter(Boolean));
  return owners.size;
}

// Streaming leaderboard: scores traders one batch at a time and calls onRow as
// results arrive, so the UI can render progressively instead of blocking.
export type LeaderRow = { managerId: string; owner: string; pnl: number; volume: number; positions: number };
export async function streamLeaderboard(
  limit: number,
  onRow: (row: LeaderRow) => void
): Promise<void> {
  const managers = await getManagers();
  const seenOwners = new Set<string>();
  const slice: any[] = [];
  for (const m of managers) {
    const owner = m.owner;
    if (m.manager_id && owner && !seenOwners.has(owner)) {
      seenOwners.add(owner);
      slice.push(m);
    }
    if (slice.length >= limit) break;
  }
  // Score in small batches so rows appear quickly and we don't hammer the server.
  const BATCH = 5;
  for (let i = 0; i < slice.length; i += BATCH) {
    const batch = slice.slice(i, i + BATCH);
    await Promise.all(batch.map(async (m) => {
      let pnl = 0, volume = 0, positions = 0;
      try {
        const summary = await getManagerSummary(m.manager_id);
        // /summary has reliable realized_pnl + unrealized_pnl (6-decimal).
        pnl = Number(summary?.realized_pnl ?? 0) / 1e6;
        positions = Number(summary?.open_positions ?? 0);
        // account_value / exposure stands in for activity/volume signal.
        volume = Number(summary?.account_value ?? summary?.open_exposure ?? 0) / 1e6;
      } catch {}
      onRow({ managerId: m.manager_id, owner: m.owner, pnl, volume, positions });
    }));
  }
}

// Get the soonest-expiring active oracle for the live demo round, with the
// real expiry, forward, and an ATM strike on the grid.
export async function getSoonestOracle(): Promise<{
  oracleId: string; strike: string; expiry: number; forward: number; minutesLeft: number;
} | null> {
  const o = await getActiveOracle(); // already picks soonest + computes ATM strike
  if (!o) return null;
  const expiry = Number(o.expiry);
  return {
    oracleId: o.oracleId,
    strike: o.strike,
    expiry,
    forward: o.forward,
    minutesLeft: Math.max(0, Math.round((expiry - Date.now()) / 60000)),
  };
}

// Fetch a manager's full account summary (positions, exposure, PnL, redeemable).
export async function getManagerAccount(managerId: string): Promise<any> {
  return predictFetch(`/managers/${managerId}/summary`);
}

// Find the user's manager and return its account summary. A user may own many
// managers (created during testing); we pick the one with the most activity
// (open positions, then redeemable, then balance) so the UI shows the real one.
export async function getMyManagerAccount(owner: string): Promise<{ managerId: string; summary: any } | null> {
  const managers = await getManagers();
  const mine = managers.filter((m: any) => (m.owner || '').toLowerCase() === owner.toLowerCase());
  if (!mine.length) return null;

  // De-dup manager ids, then fetch summaries for a reasonable slice.
  const ids = Array.from(new Set(mine.map((m: any) => m.manager_id))).slice(0, 15);
  const summaries = await Promise.all(ids.map(async (id) => {
    try { return { managerId: id, summary: await getManagerAccount(id) }; }
    catch { return null; }
  }));
  const valid = summaries.filter(Boolean) as { managerId: string; summary: any }[];
  if (!valid.length) return null;

  // Rank: open positions desc, then redeemable, then trading balance.
  valid.sort((a, b) => {
    const ap = Number(a.summary?.open_positions || 0), bp = Number(b.summary?.open_positions || 0);
    if (bp !== ap) return bp - ap;
    const ar = Number(a.summary?.redeemable_value || 0), br = Number(b.summary?.redeemable_value || 0);
    if (br !== ar) return br - ar;
    return Number(b.summary?.trading_balance || 0) - Number(a.summary?.trading_balance || 0);
  });
  return valid[0];
}

// Fetch a manager's minted/redeemed positions (with oracle, strike, expiry, side).
export async function getManagerPositions(managerId: string): Promise<{ minted: any[]; redeemed: any[] }> {
  const data = await predictFetch(`/managers/${managerId}/positions`);
  return { minted: data?.minted || [], redeemed: data?.redeemed || [] };
}