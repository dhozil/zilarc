# Zilarc DEX

**Decentralized Exchange on Arc Network** — Swap, provide liquidity, and bridge USDC across chains via Circle CCTP.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Arc%20Testnet-orange.svg)](https://testnet.arcscan.app)
[![Stack](https://img.shields.io/badge/Stack-TanStack%20Start-FF4154?logo=react&logoColor=white)](https://tanstack.com/start)
[![Chain](https://img.shields.io/badge/Chain-USDC%20native%20gas-3B82F6?logo=ethereum&logoColor=white)](https://arc.network)

---

## Features

| Feature | Description |
|---|---|
| **Swap** | Real-time token swaps: USDC, Z, NEON, JETT with automatic price discovery |
| **Pool** | Provide liquidity to earn trading fees on 6 pools |
| **Bridge** | Cross-chain USDC via Circle CCTP — Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, Linea |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (SSR + islands) |
| Build Tool | Vite |
| UI | React 19 + shadcn/ui |
| Web3 | wagmi v3 + viem |
| Smart Contracts | Solidity + Foundry |
| Bridge | Circle App Kit (CCTPv2) |
| Deployment | Vercel Edge Functions |
| Chain | Arc Testnet (chain ID: `5042002`) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/dhozil/zilarc.git
cd zilarc
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Environment Variables (optional)

Copy `.env.example` to `.env.local` and fill in if needed:

```bash
VITE_CIRCLE_API_KEY=your_circle_api_key_here
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_APP_NAME=Zilarc
```

---

## Project Structure

```
zilarc/
├── src/
│   ├── components/          # UI components (shadcn/ui + custom)
│   │   └── ui/               # shadcn/ui base components
│   ├── hooks/                # Business logic hooks
│   │   ├── useSwap.ts        # Swap execution + approval flow
│   │   ├── useAddLiquidity.ts
│   │   ├── useBalance.ts
│   │   └── useWallet.tsx
│   ├── lib/                  # Core libraries
│   │   ├── wagmi.ts         # Chain config, tokens, pools
│   │   ├── circle.ts        # AppKit bridge + quote logic
│   │   └── bridge.ts        # Bridge USDC via AppKit
│   └── routes/              # TanStack Start file-based routes
│       ├── index.tsx        # Home (swap)
│       ├── pool.tsx         # Liquidity pools
│       ├── bridge.tsx       # Cross-chain bridge
│       └── swap.tsx
├── contracts/                # Solidity contracts
│   ├── ZilarcSwap.sol       # AMM swap contract
│   └── ZilarcToken.sol     # ERC-20 token
├── script/                  # Foundry deployment scripts
├── api/
│   └── rpc-proxy.ts         # CORS proxy for Arc RPC
├── public/icons/            # Chain + token icons
└── foundry.toml             # Foundry config
```

---

## Smart Contracts

| Contract | Address | Purpose |
|---|---|---|
| **ZilarcSwap** | — | AMM for swap + liquidity |
| **ZilarcToken** | — | ERC-20 token |
| **USDC** | `0x3600000000000000000000000000000000000000` | Native USDC on Arc |
| **EURC** | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | Euro-pegged stablecoin |

### Liquidity Pools

| Pair | Address |
|---|---|
| USDC ↔ Z | `0x39cf4b39247063ab3eaaef3dbd3afc77114dcc63` |
| USDC ↔ NEON | `0x26Cb48F4C8e014604c4f890e88aB76ad9DDC64b8` |
| USDC ↔ JETT | `0x65aEBaD4E6FAE62ab67526131E66A903D5C025f7` |
| Z ↔ NEON | `0x9aa9c6d1E6a39e56E408B7b7d1644bD4c94A504f` |
| Z ↔ JETT | `0xe450fbb9935480e217D118639Ec6071e128dd2d2` |
| NEON ↔ JETT | `0x62cf458a17F023fC2Ff6A8b088339E8a1ADfeE8d` |

---

## Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Set environment variables in [Vercel Dashboard](https://vercel.com/dashboard) → your project → Settings → Environment Variables.

### Build locally

```bash
npm run build
npm start
```

---

## Development

### Foundry (Smart Contracts)

```bash
# Compile contracts
forge build

# Run tests
forge test -vvv

# Format
forge fmt

# Deploy (requires .env)
source .env && forge script script/DeploySwap.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

### Run Solidity tests

```bash
forge test
```

---

## Supported Chains

| Network | Chain ID | Role |
|---|---|---|
| **Arc Testnet** | `5042002` | Primary chain (USDC as gas) |
| Ethereum Sepolia | `11155111` | Bridge destination |
| Arbitrum Sepolia | `421614` | Bridge destination |
| Base Sepolia | `84532` | Bridge destination |
| Optimism Sepolia | `11155420` | Bridge destination |
| Polygon Amoy | `80002` | Bridge destination |
| Avalanche Fuji | `43113` | Bridge destination |
| Linea Sepolia | `59141` | Bridge destination |

---

## Useful Links

| Resource | URL |
|---|---|
| DApp | https://zilarc.web.id |
| Block Explorer | https://testnet.arcscan.app |
| Arc Faucet | https://faucet.circle.com |
| Circle Docs | https://developers.circle.com |
| Arc Network | https://arc.network |

---

## Contributing

Contributions welcome. Open an issue first for major changes.

---

## License

MIT — see [LICENSE](LICENSE)