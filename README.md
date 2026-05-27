# Zilarc DEX

### Decentralized Exchange on Arc Network

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Network: Arc Testnet](https://img.shields.io/badge/Network-Arc%20Testnet-orange?style=flat)](https://testnet.arcscan.app)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat)](https://vercel.com)

---

> Swap, Bridge & Earn - the modern DEX for USDC, Z, NEON & JETT tokens on Arc.

<p align="center">
  <img src="public/icons/zilarc.svg" alt="Zilarc" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Swap-USDC%20%E2%9E%97%20Z-4F46E5?style=for-the-badge" alt="Swap">
  <img src="https://img.shields.io/badge/Bridge-Cross--Chain-FF6B6B?style=for-the-badge" alt="Bridge">
  <img src="https://img.shields.io/badge/Pool-Liquidity-10B981?style=for-the-badge" alt="Pool">
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **Swap** | Trade USDC, Z, NEON & JETT at real-time prices |
| **Bridge** | Cross-chain USDC via Circle's CCTP |
| **Pool** | Provide liquidity and earn trading fees |

---

## Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:8080](http://localhost:8080)

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 19, TanStack Start, Vite |
| Blockchain | wagmi v3, viem |
| Smart Contracts | Solidity, Foundry |
| Bridge | Circle App Kit (CCTPv2) |
| Network | Arc Testnet `5042002` |

---

## Live URLs

| Resource | Link |
|----------|------|
| DApp | https://dex-zilarc.vercel.app |
| Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com |

## Supported Chains

### Tokens
| Token | Symbol | Address | Decimals |
|-------|--------|---------|----------|
| USDC | USDC | `0x3600000000000000000000000000000000000000` | 6 |
| Zilarc | Z | `0xdAca6186A7741d64C6bd7B33f918C46A52802c8A` | 18 |
| Neon | NEON | `0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909` | 18 |
| Jett | JETT | `0x404d8405753987E4f26e0E858fE5F5A1649ba35a` | 18 |

### Pools (Every Pair)
| Pair | Pool Address |
|------|-------------|
| USDC → Z | `0x39cf4b39247063ab3eaaef3dbd3afc77114dcc63` |
| USDC → NEON | `0x26Cb48F4C8e014604c4f890e88aB76ad9DDC64b8` |
| USDC → JETT | `0x65aEBaD4E6FAE62ab67526131E66A903D5C025f7` |
| Z → NEON | `0x9aa9c6d1E6a39e56E408B7b7d1644bD4c94A504f` |
| Z → JETT | `0xe450fbb9935480e217D118639Ec6071e128dd2d2` |
| NEON → JETT | `0x62cf458a17F023fC2Ff6A8b088339E8a1ADfeE8d` |

ERC-20 ABI & pool configs are in [`src/lib/wagmi.ts`](src/lib/wagmi.ts) (`ARC_TOKENS`, `SWAP_POOLS`).

---

## Supported Chains

| Network | Status |
|---------|--------|
| Arc Testnet | Primary |
| Ethereum Sepolia | Bridge |
| Arbitrum Sepolia | Bridge |
| Base Sepolia | Bridge |
| Optimism Sepolia | Bridge |
| Polygon Amoy | Bridge |
| Avalanche Fuji | Bridge |
| Linea Sepolia | Bridge |

---

## License

MIT - 2024

---

Built on [Arc Network](https://arc.network)