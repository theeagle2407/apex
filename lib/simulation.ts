// Backtest simulation for the PLP + Hedge structured vault.
// Runs a deposit through a sequence of BTC return scenarios, comparing:
//   - Raw PLP: full vault exposure, eats the entire left tail
//   - PLP + Hedge: spends a slice of yield on OTM downside binaries that pay
//     out in crashes, capping drawdown
//
// This is a transparent, deterministic model (not curve-fit): each period the
// vault accrues PLP yield, and in down periods the hedge reimburses part of the
// loss proportional to the configured protection.

export interface SimParams {
  deposit: number;
  plpApy: number;        // annual %, e.g. 25
  hedgeRatio: number;    // 0..1 of yield spent on hedges
  protection: number;    // 0..1 of deposit shielded in a crash
  periods: number;       // number of settlement periods to simulate
}

export interface SimPoint {
  period: number;
  btcReturn: number;     // % move that period
  plpValue: number;      // raw PLP path
  hedgedValue: number;   // PLP+hedge path
}

export interface SimResult {
  points: SimPoint[];
  plpFinal: number;
  hedgedFinal: number;
  plpMaxDrawdown: number;   // %
  hedgedMaxDrawdown: number; // %
  plpReturn: number;        // %
  hedgedReturn: number;     // %
}

// A representative BTC return path including two sharp crashes (left tail),
// modeled on real historical-style shocks. Deterministic so the chart is stable.
const BTC_PATH = [
  2.1, -1.3, 3.4, 1.8, -2.2, 4.1, -0.9, 2.6, -28.0, // crash 1 (~ -28%)
  5.2, 3.1, -4.0, 6.3, 2.0, -1.1, 3.8, -19.0,        // crash 2 (~ -19%)
  4.5, 2.2, 3.0, 1.5, -2.8, 5.0, 2.4,
];

export function runSimulation(p: SimParams): SimResult {
  const n = Math.min(p.periods, BTC_PATH.length);
  const perPeriodYield = (p.plpApy / 100) / 52; // weekly-ish accrual
  const hedgeCostPerPeriod = perPeriodYield * p.hedgeRatio;

  let plp = p.deposit;
  let hedged = p.deposit;
  let plpPeak = p.deposit, hedgedPeak = p.deposit;
  let plpMaxDD = 0, hedgedMaxDD = 0;
  const points: SimPoint[] = [];

  for (let i = 0; i < n; i++) {
    const r = BTC_PATH[i] / 100;

    // Raw PLP: earns yield; in a crash the vault pays out option liability,
    // so PLP value takes a hit scaled by the size of the down move.
    plp *= (1 + perPeriodYield);
    if (r < 0) plp *= (1 + r * 0.6); // vault absorbs ~60% of the move as liability

    // PLP + Hedge: same yield minus hedge cost; the hedge pays in crashes,
    // reimbursing the protected fraction of the would-be loss.
    hedged *= (1 + perPeriodYield - hedgeCostPerPeriod);
    if (r < 0) {
      const rawHit = r * 0.6;
      const reimbursed = -rawHit * p.protection; // hedge payout offsets the loss
      hedged *= (1 + rawHit + reimbursed);
    }

    plpPeak = Math.max(plpPeak, plp);
    hedgedPeak = Math.max(hedgedPeak, hedged);
    plpMaxDD = Math.max(plpMaxDD, (plpPeak - plp) / plpPeak * 100);
    hedgedMaxDD = Math.max(hedgedMaxDD, (hedgedPeak - hedged) / hedgedPeak * 100);

    points.push({ period: i + 1, btcReturn: BTC_PATH[i], plpValue: plp, hedgedValue: hedged });
  }

  return {
    points,
    plpFinal: plp,
    hedgedFinal: hedged,
    plpMaxDrawdown: plpMaxDD,
    hedgedMaxDrawdown: hedgedMaxDD,
    plpReturn: (plp / p.deposit - 1) * 100,
    hedgedReturn: (hedged / p.deposit - 1) * 100,
  };
}