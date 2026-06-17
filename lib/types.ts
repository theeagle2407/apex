export type MarketCategory = 'crypto' | 'sports' | 'culture' | 'finance' | 'politics' | 'entertainment';
export type PositionSide = 'yes' | 'no';
export type MarketStatus = 'active' | 'settling' | 'settled';

export interface Market {
  id: string;
  oracleId: string;
  question: string;
  description: string;
  category: MarketCategory;
  expiry: string;
  strike?: number;
  yesPrice: number;   // 0..1 probability
  noPrice: number;    // 0..1 probability
  volume: number;
  liquidity: number;
  status: MarketStatus;
  image?: string;
  // On-chain values for real minting (from the live oracle grid)
  onchainStrike?: string;  // 9-decimal strike as string (e.g. "50000000000000")
  onchainExpiry?: string;  // ms expiry as string
}

export interface Position {
  id: string;
  marketId: string;
  question: string;
  side: PositionSide;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  status: 'open' | 'won' | 'lost';
}

export interface VaultSummary {
  totalValue: number;
  totalShares: number;
  apr: number;
  myShares: number;
  myValue: number;
}