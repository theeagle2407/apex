'use client';

import { Transaction } from '@mysten/sui/transactions';
import {
  PREDICT_PACKAGE,
  PREDICT_OBJECT,
  PREDICT_SERVER,
  DUSDC_TYPE,
  DUSDC_DECIMALS,
  PLP_TYPE,
} from './constants';

export function toBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** DUSDC_DECIMALS));
}
export function fromBaseUnits(units: bigint | string | number): number {
  return Number(units) / 10 ** DUSDC_DECIMALS;
}

/**
 * DeepBook Predict real signatures (verified on testnet package):
 *
 *  market_key::up(ID oracle, U64 strike, U64 expiry)  -> MarketKey   (YES)
 *  market_key::down(ID oracle, U64 strike, U64 expiry)-> MarketKey   (NO)
 *
 *  predict::create_manager(ctx) -> ID
 *  predict::mint(&mut Predict, &mut PredictManager, &OracleSVI,
 *                MarketKey, U64 amount, &Clock, ctx)
 *  predict::supply<T>(&mut Predict, Coin<T>, &Clock, ctx) -> Coin<PLP>
 *
 * Strike & expiry use 9-decimal / ms units matching the oracle grid.
 */

// Create a fresh PredictManager (call once per user). predict::create_manager
// internally creates and shares the manager (PredictManager has key-only, so it
// cannot be transferred by us). It returns an ID which we ignore — we re-fetch
// the manager afterward via findManager.
export function buildCreateManagerTx(sender: string): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::create_manager`,
    arguments: [],
  });
  return tx;
}

// Mint a YES (up) or NO (down) position against a live oracle.
// Per DeepBook team guidance (confirmed by their live proof tx):
//   - market_key::up/down takes (oracle_id, EXPIRY, STRIKE) — expiry BEFORE strike
//   - mint pays from the manager's internal balance, so deposit DUSDC first
//   - strike must be at-the-money (near the forward) or pricing aborts
//   - quantity is the number of contracts to mint
export function buildMintTx(params: {
  sender: string;
  managerId: string;     // user's PredictManager object id
  oracleId: string;      // OracleSVI object id
  strike: bigint;        // 9-decimal strike, near the forward (ATM)
  expiry: bigint;        // ms expiry, read from the oracle (not hardcoded)
  side: 'yes' | 'no';
  depositAmount: number; // human DUSDC to fund the manager with
  quantity: bigint;      // number of contracts to mint (base units)
  dusdcCoinId: string;   // coin to fund the manager from
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);
  const depositBase = toBaseUnits(params.depositAmount);

  // 1. Split DUSDC and deposit it into the manager's internal balance.
  const [stake] = tx.splitCoins(tx.object(params.dusdcCoinId), [tx.pure.u64(depositBase)]);
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(params.managerId),
      stake,
    ],
  });

  // 2. Build the market key — ORDER IS (oracle_id, EXPIRY, STRIKE).
  const keyFn = params.side === 'yes' ? 'up' : 'down';
  const marketKey = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiry),   // expiry FIRST
      tx.pure.u64(params.strike),   // strike SECOND
    ],
  });

  // 3. Mint — pays from the manager's deposited balance. quantity = contracts.
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::mint`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_OBJECT),
      tx.object(params.managerId),
      tx.object(params.oracleId),
      marketKey,
      tx.pure.u64(params.quantity),
      tx.object('0x6'),
    ],
  });

  return tx;
}

// Supply liquidity to the shared vault; receive PLP, transfer it back to sender.
export function buildSupplyTx(params: {
  sender: string;
  amount: number;
  dusdcCoinId: string;
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);

  const [deposit] = tx.splitCoins(tx.object(params.dusdcCoinId), [
    tx.pure.u64(toBaseUnits(params.amount)),
  ]);

  const plp = tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::supply`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_OBJECT),
      deposit,
      tx.object('0x6'),
    ],
  });

  tx.transferObjects([plp], params.sender);
  return tx;
}

export async function findDusdcCoin(client: any, owner: string): Promise<{ id: string; balance: number } | null> {
  try {
    const coins = await client.getCoins({ owner, coinType: DUSDC_TYPE });
    if (!coins?.data?.length) return null;
    const sorted = [...coins.data].sort((a, b) => Number(b.balance) - Number(a.balance));
    return { id: sorted[0].coinObjectId, balance: fromBaseUnits(sorted[0].balance) };
  } catch (err) {
    console.error('findDusdcCoin error:', err);
    return null;
  }
}

// Find an existing PredictManager associated with the user.
// The manager has key-only ability and is created via create_manager; it may be
// owned or shared. We check owned objects first.
export async function findManager(client: any, owner: string): Promise<string | null> {
  // The PredictManager is key-only and shared, so getOwnedObjects won't find it.
  // Use the public indexer's /managers list to find an existing manager for this
  // owner — this prevents creating a brand-new manager on every trade.
  try {
    const res = await fetch(`${PREDICT_SERVER}/managers`);
    if (res.ok) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.managers || []);
      const mine = arr.filter((m: any) => (m.owner || '').toLowerCase() === owner.toLowerCase());
      if (mine.length) {
        // Prefer the manager with funds/positions if we can tell; else the first.
        // Fetch a few summaries to pick the funded one.
        const ids = Array.from(new Set(mine.map((m: any) => m.manager_id))).slice(0, 10);
        let best: string | null = null; let bestScore = -1;
        for (const id of ids) {
          try {
            const s = await (await fetch(`${PREDICT_SERVER}/managers/${id}/summary`)).json();
            const score = Number(s?.trading_balance || 0) + Number(s?.open_exposure || 0) + Number(s?.redeemable_value || 0);
            if (score > bestScore) { bestScore = score; best = id; }
          } catch {}
        }
        return best || ids[0];
      }
    }
  } catch (err) {
    console.error('findManager indexer error:', err);
  }
  return null;
}

// Extract a newly-created PredictManager id from a transaction's effects.
// Works whether the manager is owned or shared.
export function managerIdFromEffects(result: any): string | null {
  try {
    const changes = result?.objectChanges || [];
    for (const c of changes) {
      if (c.type === 'created' && typeof c.objectType === 'string'
          && c.objectType.includes('predict_manager::PredictManager')) {
        return c.objectId;
      }
    }
    // fallback: scan created in effects
    const created = result?.effects?.created || [];
    if (created.length) return created[0].reference?.objectId || null;
    return null;
  } catch {
    return null;
  }
}

// Withdraw liquidity: hand in PLP coin, receive DUSDC back.
// withdraw<T>(&mut Predict, Coin<PLP>, &Clock, ctx) -> Coin<T>
export function buildWithdrawTx(params: {
  sender: string;
  plpCoinId: string;
  plpAmount: bigint;   // base units (6 decimals)
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);

  const [shares] = tx.splitCoins(tx.object(params.plpCoinId), [tx.pure.u64(params.plpAmount)]);

  const dusdc = tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::withdraw`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_OBJECT),
      shares,
      tx.object('0x6'),
    ],
  });

  tx.transferObjects([dusdc], params.sender);
  return tx;
}

// Find the user's PLP coin to withdraw from.
export async function findPlpCoin(client: any, owner: string): Promise<{ id: string; balance: bigint } | null> {
  try {
    const coins = await client.getCoins({ owner, coinType: PLP_TYPE });
    if (!coins?.data?.length) return null;
    const sorted = [...coins.data].sort((a, b) => Number(b.balance) - Number(a.balance));
    return { id: sorted[0].coinObjectId, balance: BigInt(sorted[0].balance) };
  } catch (err) {
    console.error('findPlpCoin error:', err);
    return null;
  }
}

// Redeem a settled position to claim winnings. Same key arg order as mint:
// market_key::up/down(oracle_id, EXPIRY, STRIKE), then
// predict::redeem(&mut Predict, &mut PredictManager, &OracleSVI, MarketKey, U64, &Clock, ctx).
export function buildRedeemTx(params: {
  sender: string;
  managerId: string;
  oracleId: string;
  strike: bigint;
  expiry: bigint;
  side: 'yes' | 'no';
  quantity: bigint;
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);

  const keyFn = params.side === 'yes' ? 'up' : 'down';
  const marketKey = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::${keyFn}`,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiry),
      tx.pure.u64(params.strike),
    ],
  });

  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::redeem`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_OBJECT),
      tx.object(params.managerId),
      tx.object(params.oracleId),
      marketKey,
      tx.pure.u64(params.quantity),
      tx.object('0x6'),
    ],
  });

  return tx;
}

// Withdraw available DUSDC from the manager's internal balance back to wallet.
// predict_manager::withdraw(&mut PredictManager, U64, &mut TxContext) -> Coin
export function buildManagerWithdrawTx(params: {
  sender: string;
  managerId: string;
  amount: bigint; // base units
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);
  const coin = tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict_manager::withdraw`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(params.managerId),
      tx.pure.u64(params.amount),
    ],
  });
  tx.transferObjects([coin], params.sender);
  return tx;
}

// PLP + HEDGE in a single atomic PTB (the structured-vault spine).
// In one transaction:
//   1. Supply the bulk of the deposit to the PLP vault (earns the house yield).
//   2. Deposit a small hedge budget into the manager and mint a downside
//      (DOWN) binary as crash insurance against the same live BTC oracle.
// Both legs settle/clear together — the LP gets PLP yield with a built-in floor.
export function buildSupplyHedgeTx(params: {
  sender: string;
  managerId: string;
  oracleId: string;
  strike: bigint;       // ATM-ish strike for the hedge leg
  expiry: bigint;
  dusdcCoinId: string;
  supplyAmount: number; // DUSDC into PLP
  hedgeAmount: number;  // DUSDC budget for the hedge premium
  hedgeQuantity: bigint; // contracts of downside protection
}): Transaction {
  const tx = new Transaction();
  tx.setSender(params.sender);

  // Split the two budgets from the user's DUSDC coin.
  const [supplyCoin, hedgeCoin] = tx.splitCoins(tx.object(params.dusdcCoinId), [
    tx.pure.u64(toBaseUnits(params.supplyAmount)),
    tx.pure.u64(toBaseUnits(params.hedgeAmount)),
  ]);

  // Leg 1 — supply to PLP, return shares to the user.
  const plp = tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::supply`,
    typeArguments: [DUSDC_TYPE],
    arguments: [tx.object(PREDICT_OBJECT), supplyCoin, tx.object('0x6')],
  });
  tx.transferObjects([plp], params.sender);

  // Leg 2 — fund the manager and mint the DOWN hedge.
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict_manager::deposit`,
    typeArguments: [DUSDC_TYPE],
    arguments: [tx.object(params.managerId), hedgeCoin],
  });
  const hedgeKey = tx.moveCall({
    target: `${PREDICT_PACKAGE}::market_key::down`,
    arguments: [
      tx.pure.id(params.oracleId),
      tx.pure.u64(params.expiry),
      tx.pure.u64(params.strike),
    ],
  });
  tx.moveCall({
    target: `${PREDICT_PACKAGE}::predict::mint`,
    typeArguments: [DUSDC_TYPE],
    arguments: [
      tx.object(PREDICT_OBJECT),
      tx.object(params.managerId),
      tx.object(params.oracleId),
      hedgeKey,
      tx.pure.u64(params.hedgeQuantity),
      tx.object('0x6'),
    ],
  });

  return tx;
}