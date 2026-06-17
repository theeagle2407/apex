// PLP vault risk model for the risk dashboard.
// Uses the real vault summary fields from the Predict server:
//   vault_value, available_liquidity, plp_total_supply, plp_share_price,
//   utilization, max_payout_utilization, total_max_payout, total_mtm,
//   total_supplied, total_withdrawn, net_deposits  (all 6-decimal where $).

export interface VaultRisk {
  tvl: number;
  availableLiquidity: number;
  sharePrice: number;
  plpSupply: number;
  utilization: number;          // 0..1
  maxPayoutUtilization: number; // 0..1
  totalMaxPayout: number;
  totalMtm: number;
  totalSupplied: number;
  totalWithdrawn: number;
  netDeposits: number;
}

const D = 1e6;

export function parseVaultRisk(v: any): VaultRisk | null {
  if (!v || typeof v !== 'object') return null;
  return {
    tvl: (v.vault_value ?? 0) / D,
    availableLiquidity: (v.available_liquidity ?? 0) / D,
    sharePrice: v.plp_share_price ?? 1,
    plpSupply: (v.plp_total_supply ?? 0) / D,
    utilization: v.utilization ?? 0,
    maxPayoutUtilization: v.max_payout_utilization ?? 0,
    totalMaxPayout: (v.total_max_payout ?? 0) / D,
    totalMtm: (v.total_mtm ?? 0) / D,
    totalSupplied: (v.total_supplied ?? 0) / D,
    totalWithdrawn: (v.total_withdrawn ?? 0) / D,
    netDeposits: (v.net_deposits ?? 0) / D,
  };
}

// Stress test: estimate PLP share-price impact under a BTC move of n sigma,
// at an ASSUMED utilization level (so the model is meaningful even when the
// live vault is near-empty). assumedUtil 0..1 overrides current coverage.
export function stressScenario(r: VaultRisk, sigmaMove: number, assumedUtil?: number): {
  label: string;
  payoutHit: number;
  newTvl: number;
  newSharePrice: number;
  pctChange: number;
} {
  // Effective payout coverage: use the assumed utilization if provided,
  // otherwise the live max-payout utilization.
  const coverage = assumedUtil != null ? assumedUtil : r.maxPayoutUtilization;
  // A larger move triggers a larger fraction of potential payout. We scale the
  // coverage by move magnitude (each sigma ~ adds exposure), capped at 1.
  const exposureFraction = Math.min(1, coverage * (Math.abs(sigmaMove) / 5));
  // Payout liability is exposure against the notional the vault could owe.
  // Approximate max notional as coverage-implied multiple of TVL.
  const maxLiability = r.tvl * coverage;
  const payoutHit = Math.min(maxLiability * (Math.abs(sigmaMove) / 5) * 2, r.tvl);
  const newTvl = Math.max(0, r.tvl - payoutHit);
  const newSharePrice = r.plpSupply > 0 ? (newTvl / r.plpSupply) * (r.tvl > 0 ? r.sharePrice / (r.tvl / r.plpSupply) : 1) : r.sharePrice;
  const pctChange = r.tvl > 0 ? (newTvl / r.tvl - 1) * 100 : 0;
  return {
    label: `${sigmaMove > 0 ? '+' : ''}${sigmaMove}σ BTC move`,
    payoutHit,
    newTvl,
    newSharePrice,
    pctChange,
  };
}

// Health score 0..100 from utilization + coverage headroom.
export function healthScore(r: VaultRisk): { score: number; label: string; color: string } {
  const utilPenalty = r.utilization * 40;
  const payoutPenalty = r.maxPayoutUtilization * 40;
  const score = Math.max(0, Math.round(100 - utilPenalty - payoutPenalty));
  let label = 'Healthy', color = 'var(--green)';
  if (score < 50) { label = 'Stressed'; color = 'var(--red)'; }
  else if (score < 75) { label = 'Moderate'; color = 'var(--yellow)'; }
  return { score, label, color };
}