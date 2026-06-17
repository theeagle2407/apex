// SVI (Stochastic Volatility Inspired) model for DeepBook Predict oracles.
// Reconstructs the implied-volatility smile from on-chain OracleSVI params.
//
// Raw SVI params from the Predict server are scaled integers:
//   a, b, m, sigma -> divide by 1e9
//   rho            -> divide by 1e9, sign from rho_negative
//
// Total variance:  w(k) = a + b * ( rho*(k - m) + sqrt((k - m)^2 + sigma^2) )
// where k = log-moneyness = ln(strike / spot).
// Implied vol for the slice:  IV(k) = sqrt( w(k) / T ).

export interface SviParams {
  a: number;
  b: number;
  rho: number;   // signed, [-1, 1]
  m: number;
  sigma: number;
}

export interface SviRaw {
  a: number;
  b: number;
  rho: number;
  rho_negative?: boolean;
  m: number;
  m_negative?: boolean;
  sigma: number;
}

export function parseSvi(raw: SviRaw): SviParams {
  return {
    a: raw.a / 1e9,
    b: raw.b / 1e9,
    rho: (raw.rho_negative ? -1 : 1) * (raw.rho / 1e9),
    m: (raw.m_negative ? -1 : 1) * (raw.m / 1e9),
    sigma: raw.sigma / 1e9,
  };
}

// Total implied variance at log-moneyness k
export function totalVariance(p: SviParams, k: number): number {
  return p.a + p.b * (p.rho * (k - p.m) + Math.sqrt((k - p.m) ** 2 + p.sigma ** 2));
}

// Annualized implied vol (fraction, e.g. 0.37 = 37%) at log-moneyness k
export function impliedVol(p: SviParams, k: number, tYears: number): number {
  const w = totalVariance(p, k);
  if (w <= 0 || tYears <= 0) return 0;
  return Math.sqrt(w / tYears);
}

// Build a smile across a strike range around spot.
// Returns points with strike, log-moneyness k, and IV (percent).
export function buildSmile(
  p: SviParams,
  spot: number,
  tYears: number,
  rangePct = 0.05,
  steps = 41
): { strike: number; k: number; ivPct: number }[] {
  const pts: { strike: number; k: number; ivPct: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const pct = -rangePct + (2 * rangePct * i) / (steps - 1);
    const strike = spot * (1 + pct);
    const k = Math.log(strike / spot);
    pts.push({ strike, k, ivPct: impliedVol(p, k, tYears) * 100 });
  }
  return pts;
}

// Arbitrage-free sanity: total variance should be non-negative and the smile
// convex-ish. Returns a simple flag list for butterfly violations.
export function smileWarnings(pts: { k: number; ivPct: number }[]): string[] {
  const w: string[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const left = pts[i - 1].ivPct, mid = pts[i].ivPct, right = pts[i + 1].ivPct;
    // crude convexity check
    if (mid > left && mid > right) {
      w.push(`Possible butterfly arbitrage near k=${pts[i].k.toFixed(3)}`);
      break;
    }
  }
  return w;
}