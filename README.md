# APEX

**Structured liquidity on DeepBook Predict.**
Earn the house's yield. Survive the crash.

APEX is a structured-product layer built on [DeepBook Predict](https://docs.sui.io/onchain-finance/deepbook-predict/), Mysten Labs' vol-surface-priced prediction protocol on Sui. Instead of treating Predict as "another place to bet," APEX turns its primitives into a **PLP + Hedge vault**: it supplies quote liquidity to the Predict vault to earn the house's yield, and simultaneously buys out-of-the-money downside protection so a crash can't wipe the position. The product LPs actually want — *yield minus crash insurance* — wrapped in a clean consumer surface on a live, on-chain prediction market.

Built for the Sui Overflow 2026 DeepBook track.

---

## The idea

Raw PLP (the Predict liquidity pool) earns fees from every trade, but it sits on the other side of every position — so in a sharp BTC move it eats the entire left tail. That tail risk is exactly what keeps serious LPs out.

APEX's vault fixes that. In a single atomic transaction it:

1. **Supplies** the bulk of a deposit to the Predict vault via `predict::supply`, receiving `PLP` shares that accrue the house's yield.
2. **Mints** an out-of-the-money downside binary via `predict::mint`, funded from a slice of that yield, that pays out precisely when the market crashes.

The result is PLP yield with a built-in floor. A modest give-up in headline APY buys a roughly halved max drawdown through a crash — quantified in the in-app simulation.

## What's in the app

- **Vault** — supply quote to Predict and receive PLP shares; withdraw on demand. Real on-chain `supply` / `withdraw`.
- **Strategy** — the PLP + Hedge structured product. Size a deposit, tune the hedge ratio, and **deploy the supply + hedge in one atomic PTB** on testnet.
- **Risk** — a PLP risk dashboard: live vault utilization, a ±5σ stress test, and a **simulation** running PLP vs PLP+Hedge through two BTC crashes (drawdown roughly halved).
- **Surface** — the live SVI implied-volatility smile, reconstructed straight from on-chain `OracleSVI` parameters. The vol surface the hedge is priced against.
- **Markets** — the live prediction floor the vault is built on, including a **live sub-hour BTC round** with a settlement countdown. Real mint against the active oracle.
- **Portfolio** — real DUSDC + PLP balances, your open PredictManager positions, claim (`redeem`) of settled winnings, withdraw to wallet, and on-chain transaction history.

## End-to-end on-chain flow (all working on Sui testnet)

```
create/find PredictManager
   → deposit DUSDC
      → mint position  (predict::mint)
         → oracle settles
            → claim winnings  (predict::redeem)
               → withdraw to wallet
```

Plus the structured-vault path: **supply to PLP + mint hedge, atomically, in one transaction.**

## Tech

- Next.js (App Router) + TypeScript
- `@mysten/sui` + `@mysten/dapp-kit` + TanStack Query
- Slush wallet, Sui Testnet
- Data via the public Predict indexer (`predict-server.testnet.mystenlabs.com`), with direct on-chain reads around wallet flows — the integration model the docs recommend.

## Contract targets (Sui Testnet, `predict-testnet-4-16`)

| | |
|---|---|
| Predict package | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138` |
| Predict object | `0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a` |
| Registry | `0x43af14fed5480c20ff77e2263d5f794c35b9fab7e2212903127062f4fe2a6e64` |
| Quote asset (DUSDC) | `0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC` |
| PLP coin | `0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138::plp::PLP` |
| Server | `https://predict-server.testnet.mystenlabs.com` |

These are testnet integration targets and will change at mainnet launch; APEX reads them from `lib/constants.ts` so a redeploy is a one-file change.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, connect a Slush wallet on Sui Testnet, and request testnet DUSDC via the [DeepBook Predict token form](https://tally.so/r/Xx102L).

## Notes on the model

The vault's hedge legs and the risk simulation use transparent, deterministic models (clearly labeled in-app) to illustrate PLP-vs-hedged behavior — they are illustrative, not a curve-fit historical backtest. All balances, positions, oracle parameters, vault state, and the volatility surface are **real, read live from chain / the Predict indexer**. On testnet the only underlying is BTC (Mysten's rolling sub-hour oracles); APEX is data-driven and surfaces additional assets automatically as they come online at mainnet.

---

Built by [@theeagle2407](https://github.com/theeagle2407).