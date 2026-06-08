# Zilarc DEX

### Decentralized Exchange on Arc Network

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Network: Arc Testnet](https://img.shields.io/badge/Network-Arc%20Testnet-orange?style=flat)](https://testnet.arcscan.app)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat)](https://vercel.com)

---

> Single-call AMM swaps, cross-chain USDC bridging, and live liquidity provision — built around Circle's stablecoin stack on Arc Testnet.

<p align="center">
  <img src="public/icons/zilarc.svg" alt="Zilarc" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Swap-Multi--Token-4F46E5?style=for-the-badge" alt="Swap">
  <img src="https://img.shields.io/badge/Bridge-Cross--Chain-FF6B6B?style=for-the-badge" alt="Bridge">
  <img src="https://img.shields.io/badge/Pool-Liquidity-10B981?style=for-the-badge" alt="Pool">
</p>

---

## Features

| Feature | Description |
|---|---|
| **Swap** | Single-tx AMM swaps over `ZilarcRouter`. Supports USDC native (precompile), EURC, Z, NEON, JETT. Slippage + deadline enforced on-chain. |
| **Pool** | Add/remove liquidity on 10 constant-product pools (0.3% fee). USDC pools accept native gas via `msg.value`; ERC-20 pairs use approve + transferFrom. |
| **Bridge** | Cross-chain USDC via Circle CCTP — Sepolia, Arbitrum, Base, Optimism, Polygon Amoy, Avalanche Fuji, Linea Sepolia. |
| **Live stats** | Home and pool pages aggregate TVL, 24h volume, trade count, and APY directly from on-chain pool reserves and `Swap` event logs (refreshed every 30 s). |

---

## Architecture

```
                      ┌──────────────────────────┐
   user wallet ──────▶│      ZilarcRouter        │
                      │  swap(tokenIn, tokenOut, │
                      │   amountIn, amountOutMin,│
                      │   recipient, deadline)   │
                      └─────────────┬────────────┘
                                    │ approve + delegate
                                    ▼
                      ┌──────────────────────────┐
                      │   ZilarcSwap pool (x*y=k)│
                      │  tokenA / tokenB         │
                      │  reserveA / reserveB     │
                      └──────────────────────────┘
                              ▲
                              │ msg.value (native USDC)
                              │
                  Arc USDC precompile (0x3600…0000)
```

- One transaction per swap. The user's wallet sees a single `swap()` call;
  the router handles approvals, native USDC routing, and slippage checks
  internally.
- The same router fronts every pool, so adding new pairs is a single
  `registerPool()` call by the owner — no new contract deploys for the
  frontend to wire up.
- `Swap` events emit on the router with `(sender, recipient, tokenIn,
  tokenOut, amountIn, amountOut, pool)`, so explorers and indexers can
  display them as proper swaps instead of generic contract calls.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR + islands) |
| Build Tool | Vite |
| UI | React 19 + shadcn/ui + Tailwind v4 |
| Web3 | wagmi v3 + viem 2.x |
| Smart Contracts | Solidity 0.8.20 + OpenZeppelin v5 + Foundry |
| Bridge | Circle App Kit (CCTPv2) |
| Deployment | Vercel + Nitro |
| Chain | Arc Testnet (chain ID `5042002`) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Foundry (for contract scripts) — install at <https://getfoundry.sh>

### Setup

```bash
git clone https://github.com/dhozil/zilarc.git
cd zilarc
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Arc Testnet RPC
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
ARCTEST_RPC_URL=https://rpc.testnet.arc.network

# ZilarcRouter (single-call AMM router)
VITE_ZILARC_ROUTER=0x72F8C8e1b027aca6d4e2474E58fc4FdFB1D193b9

# Foundry / forge deploy (DO NOT COMMIT)
PRIVATE_KEY=0xyour_private_key_here

# Circle App Kit (server-side; powers the CCTP bridge)
KIT_KEY=your_kit_key_here

# App config
VITE_APP_NAME=Zilarc
VITE_APP_BASE_URL=https://zilarc.vercel.app
```

---

## Project Structure

```
zilarc/
├── src/
│   ├── components/          # UI components (shadcn/ui + custom)
│   │   └── ui/              # shadcn/ui base components
│   ├── hooks/               # Business logic hooks
│   │   ├── useSwap.ts        # Router + direct-pool swap, slippage, quotes
│   │   ├── useAddLiquidity.ts# AMM addLiquidity (USDC native + ERC-20)
│   │   ├── usePoolData.ts    # Per-pool reserves / fee / supply
│   │   ├── useDexStats.ts    # Aggregate TVL / volume / trades for UI
│   │   ├── useBalance.ts
│   │   └── useWallet.tsx
│   ├── lib/                  # Core libraries
│   │   ├── wagmi.ts          # Chain config, tokens, pool registry, router
│   │   ├── circle.ts         # AppKit bridge + quote logic
│   │   └── bridge.ts         # Bridge USDC via AppKit / CCTP
│   └── routes/               # TanStack Start file-based routes
│       ├── index.tsx         # Home — live stats + top markets
│       ├── swap.tsx          # Swap UI (router-backed)
│       ├── pool.tsx          # Liquidity pools + add liquidity form
│       └── bridge.tsx        # Cross-chain CCTP bridge
├── contracts/                # Solidity sources
│   ├── ZilarcRouter.sol      # Single-call AMM router (10 pools)
│   ├── ZilarcSwap.sol        # Constant-product AMM pair
│   ├── ZilarcToken.sol       # ERC-20 factory (Z / NEON / JETT)
│   └── UsdcSwapHandler.sol   # Legacy 1:1 treasury (deprecated)
├── script/                   # Foundry deployment scripts
│   ├── DeployRouter.s.sol            # Deploy router + register all pools
│   ├── DeployAndSeedEurcPools.s.sol  # 4× EURC pools, register + seed
│   ├── DeployUsdcNativePools.s.sol
│   ├── ReseedUsdcNativePools.s.sol   # Burn LP + reseed at correct ratio
│   ├── DeployCrossPools.s.sol        # Z/NEON, Z/JETT, NEON/JETT pools
│   └── DeployZilarc.s.sol  ...       # Token deploys
├── api/                      # Server-side handlers
└── foundry.toml              # Foundry config
```

---

## Smart Contracts

### Core (Arc Testnet)

| Contract | Address | Role |
|---|---|---|
| **ZilarcRouter** | `0x72F8C8e1b027aca6d4e2474E58fc4FdFB1D193b9` | Single-call AMM entrypoint. Owner-managed pool registry. |
| **USDC (native, precompile)** | `0x3600000000000000000000000000000000000000` | Arc gas token, traded as a first-class AMM asset via `msg.value`. |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6-decimal Circle stablecoin — paired against USDC, Z, NEON, JETT. |
| **Z** | `0x5D05355351eFc0d8346CB0af778A3A441CF099e6` | Example ERC-20 (`ZilarcToken`). |
| **NEON** | `0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce` | Example ERC-20 (`ZilarcToken`). |
| **JETT** | `0xcEe56f1CfF4D440Fac124706952a77805a728A70` | Example ERC-20 (`ZilarcToken`). |

### Liquidity Pools

All pools are constant-product (`x * y = k`) with a 0.3% fee, registered in `ZilarcRouter`. USDC pools hold native USDC on `tokenA`; everything else is plain ERC-20.

| Pair | Pool address |
|---|---|
| USDC ↔ Z | `0xF620b9c807bF7Dc18B9Cc50f7833c90abD630187` |
| USDC ↔ NEON | `0xeDdbCd15aa35885fd078c93Ca2d9916D9A295305` |
| USDC ↔ JETT | `0x52CBe4119D29167a2bc57b4A7C618798928AF212` |
| USDC ↔ EURC | `0x90F310c1a43AAC6c7991C20448Ca7E0Df23D6190` |
| EURC ↔ Z    | `0xE3AFAE18C17EC98f150Bdca434c10fe168069DAa` |
| EURC ↔ NEON | `0x7c6884B0ed8587d4DBC248e0207A768098b1d1CB` |
| EURC ↔ JETT | `0xB21657f9F7a4730FdD85CFA68E2F0c90c6d31BA2` |
| Z ↔ NEON    | `0xb57449127d3B158aFcB23C81780789F1e169b224` |
| Z ↔ JETT    | `0xEEbBB08A86AA26cDAA50E12E7630b84D550b9042` |
| NEON ↔ JETT | `0xc411557A60Ce64B700Fe02fFbD4EeaEFE2af3F51` |

Sample swap (USDC native → Z via router): [`0x5219b2c625b8e1…ca80`](https://testnet.arcscan.app/tx/0x5219b2c625b8e13949480e02ef532ba178e07c558e3c6b648b0ec44331f7ca80)

---

## Working with the contracts

### Compile

```bash
forge build
```

### Deploy router (one-time, all pools)

```bash
forge script script/DeployRouter.s.sol:DeployRouter \
  --rpc-url $ARCTEST_RPC_URL \
  --broadcast --legacy --slow
```

### Add EURC pools

Requires deployer EOA to hold ≥ `4 × seedUnits` EURC.

```bash
forge script script/DeployAndSeedEurcPools.s.sol:DeployAndSeedEurcPools \
  --sig "run(uint256)" 4 \
  --rpc-url $ARCTEST_RPC_URL \
  --broadcast --legacy --slow
```

After running, copy the printed pool addresses into `src/lib/wagmi.ts` (`SWAP_POOLS.USDC_EURC`, `EURC_Z`, etc.) and restart the dev server.

### Reseed USDC pools at the correct ratio

```bash
# 5 USDC native + 5 token per side per pool (15 USDC native total)
forge script script/ReseedUsdcNativePools.s.sol:ReseedUsdcNativePools \
  --sig "run(uint256)" 5000000000000000000 \
  --rpc-url $ARCTEST_RPC_URL \
  --broadcast --legacy --slow
```

### Run Solidity tests

```bash
forge test -vvv
```

---

## Live on-chain stats

The `useDexStats` hook (`src/hooks/useDexStats.ts`) drives the home and pool dashboards. It:

1. Multicalls every registered pool for `reserveA / reserveB / tokenA / tokenB / totalSupply / fee` in one RPC roundtrip.
2. Walks `Swap` event logs backward in 50 000-block chunks to cover ~24 h of activity (Arc ~3 bps).
3. Aggregates per-pool volume + trade count, then sorts by TVL descending.
4. Returns headline stats (`totalTvlUSD`, `totalVolume24hUSD`, `totalTrades24h`, `activePairs`) and a per-pool breakdown.

Token prices are pinned (USDC, Z, NEON, JETT = $1.00, EURC = $1.08) — swap in an oracle for production.

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel
```

Set environment variables (`VITE_ARC_RPC_URL`, `VITE_ZILARC_ROUTER`, `KIT_KEY`, `PRIVATE_KEY` if you run server-side App Kit calls) in **Vercel Dashboard → Settings → Environment Variables**.

### Local production build

```bash
npm run build
npm run preview
```

---

## Supported Chains

| Network | Chain ID | Role |
|---|---|---|
| **Arc Testnet** | `5042002` | Primary chain (USDC native gas, AMM, router) |
| Ethereum Sepolia | `11155111` | CCTP bridge source/destination |
| Arbitrum Sepolia | `421614` | CCTP bridge source/destination |
| Base Sepolia | `84532` | CCTP bridge source/destination |
| Optimism Sepolia | `11155420` | CCTP bridge source/destination |
| Polygon Amoy | `80002` | CCTP bridge source/destination |
| Avalanche Fuji | `43113` | CCTP bridge source/destination |
| Linea Sepolia | `59141` | CCTP bridge source/destination |

---

## Useful Links

| Resource | URL |
|---|---|
| DApp | <https://zilarc.web.id> |
| Block Explorer | <https://testnet.arcscan.app> |
| USDC + EURC Faucet | <https://faucet.circle.com> |
| Circle Docs | <https://developers.circle.com> |
| Arc Network | <https://arc.network> |

---

## Roadmap

- Multi-hop routing through `ZilarcRouter` (e.g. USDC → EURC → Z when intermediate liquidity is deeper).
- LP token incentives / staking.
- Concentrated-liquidity pools for stable pairs (USDC/EURC).
- Permit-based swaps to remove the approve step for ERC-20 input.
- Oracle integration for token prices in `useDexStats` (Chainlink, Pyth, or Circle-attested).
- Production audit pass before mainnet.

---

## Contributing

Contributions welcome. Open an issue first for major changes.

---

## License

MIT — see [LICENSE](LICENSE).
