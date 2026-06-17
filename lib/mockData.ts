import type { Market, Position, VaultSummary } from './types';

// Curated markets — APEX's distinct angle: real-world events that matter
// across crypto, African football, global culture, and finance.
export const MARKETS: Market[] = [
  {
    id: 'm1', oracleId: '0x98c00a86ca5c060c482c349f92da05763d35afc7ccf004cf49b21975f0d7e9ff',
    question: 'Will Bitcoin close above $120,000 by July 1?',
    description: 'Resolves YES if BTC/USD spot is above $120,000 at expiry per the oracle settlement price. Settles on-chain via a live DeepBook Predict BTC oracle.',
    category: 'crypto', expiry: '2026-07-01T00:00:00Z',
    strike: 120000, yesPrice: 0.62, noPrice: 0.38,
    volume: 184200, liquidity: 92000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443900000',
  },
  {
    id: 'm2', oracleId: '0x9857bc4de1291e129d508ddf72c9595dc762f4dabe66865cea8cdebc9d576d99',
    question: 'Will Nigeria win AFCON 2026?',
    description: 'Resolves YES if Nigeria are crowned champions of the 2026 Africa Cup of Nations.',
    category: 'sports', expiry: '2026-07-18T00:00:00Z',
    yesPrice: 0.28, noPrice: 0.72,
    volume: 241800, liquidity: 130000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443000000',
  },
  {
    id: 'm3', oracleId: '0xe420ef72be9d9427e3c30462c14ea38c2166b4d5fbc0242ff368bbe62f8ed5a4',
    question: 'Will the Naira fall past ₦2000/$ before September?',
    description: 'Resolves YES if NGN/USD crosses 2000 on the oracle reference rate before Sept 1.',
    category: 'finance', expiry: '2026-09-01T00:00:00Z',
    strike: 2000, yesPrice: 0.45, noPrice: 0.55,
    volume: 98700, liquidity: 54000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780442100000',
  },
  {
    id: 'm4', oracleId: '0x4536c06d7abdbd0df28bb51ea756a63faf6582e709498b777df37e9971f9ce6e',
    question: 'Will SUI flip Solana in daily DEX volume this quarter?',
    description: 'Resolves YES if Sui daily DEX volume exceeds Solana on any day before quarter end.',
    category: 'crypto', expiry: '2026-06-30T00:00:00Z',
    yesPrice: 0.18, noPrice: 0.82,
    volume: 67300, liquidity: 41000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780452000000',
  },
  {
    id: 'm5', oracleId: '0x88b6e638ef3b26f646d11a8abfe468d68201a81b24a58a3ee2a8806d1f6507d3',
    question: 'Will Burna Boy headline a US stadium show in 2026?',
    description: 'Resolves YES if Burna Boy headlines a stadium-capacity (40k+) US venue this year.',
    category: 'culture', expiry: '2026-08-15T00:00:00Z',
    yesPrice: 0.71, noPrice: 0.29,
    volume: 52400, liquidity: 33000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780440300000',
  },
  {
    id: 'm6', oracleId: '0x98c00a86ca5c060c482c349f92da05763d35afc7ccf004cf49b21975f0d7e9ff',
    question: 'Will Ethereum ETF inflows top $2B in June?',
    description: 'Resolves YES if cumulative spot ETH ETF net inflows exceed $2B for the month of June.',
    category: 'finance', expiry: '2026-06-30T00:00:00Z',
    strike: 2000000000, yesPrice: 0.54, noPrice: 0.46,
    volume: 119500, liquidity: 78000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443900000',
  },
  {
    id: 'm7', oracleId: '0x9857bc4de1291e129d508ddf72c9595dc762f4dabe66865cea8cdebc9d576d99',
    question: 'Will Morocco reach the 2026 World Cup semifinals?',
    description: 'Resolves YES if Morocco advance to the semifinal stage of the 2026 FIFA World Cup.',
    category: 'sports', expiry: '2026-07-10T00:00:00Z',
    yesPrice: 0.34, noPrice: 0.66,
    volume: 156000, liquidity: 88000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443000000',
  },
  {
    id: 'm8', oracleId: '0xe420ef72be9d9427e3c30462c14ea38c2166b4d5fbc0242ff368bbe62f8ed5a4',
    question: 'Will SUI close above $6 by end of June?',
    description: 'Resolves YES if SUI/USD spot is above $6.00 at expiry per oracle settlement.',
    category: 'crypto', expiry: '2026-06-30T00:00:00Z',
    strike: 6, yesPrice: 0.41, noPrice: 0.59,
    volume: 203100, liquidity: 110000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780442100000',
  },

  // ── Entertainment ──────────────────────────────────────────────
  {
    id: 'm9', oracleId: '0x98c00a86ca5c060c482c349f92da05763d35afc7ccf004cf49b21975f0d7e9ff',
    question: 'Will Toy Story 5 cross $1B worldwide box office?',
    description: 'Resolves YES if Toy Story 5 surpasses $1,000,000,000 in cumulative worldwide gross during its theatrical run, per Box Office Mojo.',
    category: 'entertainment', expiry: '2026-09-30T00:00:00Z',
    yesPrice: 0.58, noPrice: 0.42,
    volume: 142000, liquidity: 71000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443900000',
  },
  {
    id: 'm10', oracleId: '0x9857bc4de1291e129d508ddf72c9595dc762f4dabe66865cea8cdebc9d576d99',
    question: 'Will Spider-Man: Brand New Day open above $150M domestic?',
    description: 'Resolves YES if the film opens above $150M in its domestic opening weekend, per studio-reported figures.',
    category: 'entertainment', expiry: '2026-07-31T00:00:00Z',
    yesPrice: 0.66, noPrice: 0.34,
    volume: 98000, liquidity: 54000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443000000',
  },
  {
    id: 'm11', oracleId: '0xe420ef72be9d9427e3c30462c14ea38c2166b4d5fbc0242ff368bbe62f8ed5a4',
    question: "Will a Burna Boy single hit #1 on Nigeria's Apple Music this summer?",
    description: 'Resolves YES if any Burna Boy track reaches #1 on the Nigeria Apple Music chart between now and August 31.',
    category: 'entertainment', expiry: '2026-08-31T00:00:00Z',
    yesPrice: 0.47, noPrice: 0.53,
    volume: 176500, liquidity: 88000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780442100000',
  },
  {
    id: 'm12', oracleId: '0x4536c06d7abdbd0df28bb51ea756a63faf6582e709498b777df37e9971f9ce6e',
    question: 'Will the next Afrobeats album break 20M first-week Spotify streams?',
    description: 'Resolves YES if the next major Afrobeats album release records over 20,000,000 streams in its opening week on Spotify, beating the current Nigerian opening-week benchmark.',
    category: 'entertainment', expiry: '2026-08-15T00:00:00Z',
    yesPrice: 0.39, noPrice: 0.61,
    volume: 121000, liquidity: 60000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780452000000',
  },
  {
    id: 'm13', oracleId: '0x88b6e638ef3b26f646d11a8abfe468d68201a81b24a58a3ee2a8806d1f6507d3',
    question: 'Will Wizkid remain Nigeria\u2019s most-streamed Spotify artist in 2026?',
    description: 'Resolves YES if Wizkid finishes 2026 as the most-streamed Nigerian artist on Spotify, per Spotify Wrapped year-end data.',
    category: 'entertainment', expiry: '2026-12-31T00:00:00Z',
    yesPrice: 0.54, noPrice: 0.46,
    volume: 134000, liquidity: 67000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780440300000',
  },

  // ── African sports ─────────────────────────────────────────────
  {
    id: 'm14', oracleId: '0x98c00a86ca5c060c482c349f92da05763d35afc7ccf004cf49b21975f0d7e9ff',
    question: 'Will a Nigerian fighter win the PFL Africa main event in Lagos?',
    description: 'Resolves YES if a Nigerian fighter wins the headline bout at PFL Africa 2, June 13 at the Eko Convention Center, Lagos.',
    category: 'sports', expiry: '2026-06-13T20:00:00Z',
    yesPrice: 0.71, noPrice: 0.29,
    volume: 88000, liquidity: 44000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443900000',
  },
  {
    id: 'm15', oracleId: '0x9857bc4de1291e129d508ddf72c9595dc762f4dabe66865cea8cdebc9d576d99',
    question: 'Will Nigeria reach the 2026 World Cup knockout stage?',
    description: 'Resolves YES if Nigeria advances past the group stage of the 2026 FIFA World Cup (June 11 \u2013 July 19, hosted across USA, Mexico, Canada).',
    category: 'sports', expiry: '2026-07-03T00:00:00Z',
    yesPrice: 0.44, noPrice: 0.56,
    volume: 312000, liquidity: 156000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443000000',
  },

  // ── Global ─────────────────────────────────────────────────────
  {
    id: 'm16', oracleId: '0xe420ef72be9d9427e3c30462c14ea38c2166b4d5fbc0242ff368bbe62f8ed5a4',
    question: 'Will Argentina win back-to-back World Cups in 2026?',
    description: 'Resolves YES if Argentina are crowned champions of the 2026 FIFA World Cup, the final being July 19 at MetLife Stadium.',
    category: 'sports', expiry: '2026-07-19T00:00:00Z',
    yesPrice: 0.18, noPrice: 0.82,
    volume: 421000, liquidity: 210000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780442100000',
  },
  {
    id: 'm17', oracleId: '0x4536c06d7abdbd0df28bb51ea756a63faf6582e709498b777df37e9971f9ce6e',
    question: 'Will summer 2026 domestic box office top $4.5B?',
    description: 'Resolves YES if total US domestic box office for May\u2013August 2026 exceeds $4.5B, per Comscore season totals.',
    category: 'entertainment', expiry: '2026-09-05T00:00:00Z',
    yesPrice: 0.51, noPrice: 0.49,
    volume: 76000, liquidity: 38000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780452000000',
  },

  // ── Finance ────────────────────────────────────────────────────
  {
    id: 'm18', oracleId: '0x88b6e638ef3b26f646d11a8abfe468d68201a81b24a58a3ee2a8806d1f6507d3',
    question: 'Will the Fed cut rates at its next meeting?',
    description: 'Resolves YES if the Federal Reserve lowers the federal funds target range at its next FOMC decision.',
    category: 'finance', expiry: '2026-07-30T00:00:00Z',
    yesPrice: 0.37, noPrice: 0.63,
    volume: 289000, liquidity: 144000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780440300000',
  },
  {
    id: 'm19', oracleId: '0x98c00a86ca5c060c482c349f92da05763d35afc7ccf004cf49b21975f0d7e9ff',
    question: 'Will the Naira strengthen below \u20a61,400/USD by August?',
    description: 'Resolves YES if the official NGN/USD rate trades below \u20a61,400 per US dollar at any point before September 1.',
    category: 'finance', expiry: '2026-08-31T00:00:00Z',
    yesPrice: 0.29, noPrice: 0.71,
    volume: 167000, liquidity: 83000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443900000',
  },
  {
    id: 'm20', oracleId: '0x9857bc4de1291e129d508ddf72c9595dc762f4dabe66865cea8cdebc9d576d99',
    question: 'Will Bitcoin hold above $73K through June?',
    description: 'Resolves YES if BTC/USD does not close any daily candle below $73,000 for the remainder of June, per oracle settlement.',
    category: 'crypto', expiry: '2026-06-30T00:00:00Z',
    strike: 73000, yesPrice: 0.55, noPrice: 0.45,
    volume: 256000, liquidity: 128000, status: 'active',
    onchainStrike: '50000000000000', onchainExpiry: '1780443000000',
  },
];

export const POSITIONS: Position[] = [
  {
    id: 'p1', marketId: 'm1', question: 'Will Bitcoin close above $120,000 by July 1?',
    side: 'yes', amount: 250, entryPrice: 0.55, currentPrice: 0.62, pnl: 31.8, status: 'open',
  },
  {
    id: 'p2', marketId: 'm2', question: 'Will Nigeria win AFCON 2026?',
    side: 'yes', amount: 100, entryPrice: 0.22, currentPrice: 0.28, pnl: 27.3, status: 'open',
  },
  {
    id: 'p3', marketId: 'm5', question: 'Will Burna Boy headline a US stadium show in 2026?',
    side: 'no', amount: 80, entryPrice: 0.35, currentPrice: 0.29, pnl: 13.7, status: 'open',
  },
];

export const VAULT: VaultSummary = {
  totalValue: 1284000,
  totalShares: 1200000,
  apr: 18.4,
  myShares: 0,
  myValue: 0,
};

export const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  sports: 'Sports',
  culture: 'Culture',
  finance: 'Finance',
  politics: 'Politics',
  entertainment: 'Entertainment',
};

export const CATEGORY_EMOJI: Record<string, string> = {
  crypto: '₿',
  sports: '⚽',
  culture: '🎵',
  finance: '📈',
  politics: '🗳️',
  entertainment: '🎬',
};