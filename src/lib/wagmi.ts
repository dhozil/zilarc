import { http, createConfig } from "wagmi";
import { sepolia, arbitrum, base, optimism, polygon, avalanche, linea } from "viem/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Arc Testnet RPC - Circle
const ARC_RPC_URL = import.meta.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network";

// Arc Testnet chain definition
export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
    public: { http: [ARC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
} as const;

// Token addresses on Arc Testnet.
// USDC is the native gas token (precompile at 0x3600…0000). It is the native
// currency for `eth_getBalance` (raw wei, 1e18 scale). All AMM pools that
// pair USDC with an 18-decimal ERC-20 use the precompile address as tokenA
// and treat 1e18 wei native USDC ≈ 1 human USDC, matching ratios with
// 18-decimal Z/NEON/JETT 1:1.
export const ARC_TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  Z: "0x5D05355351eFc0d8346CB0af778A3A441CF099e6",
  NEON: "0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce",
  JETT: "0xcEe56f1CfF4D440Fac124706952a77805a728A70",
} as const;

export const USDC_PRECOMPILE = ARC_TOKENS.USDC;

// Liquidity Pool addresses (Arc Testnet).
//   USDC_*    : ZilarcSwap pools where tokenA = USDC precompile (native).
//               Native USDC moves via msg.value / address(this).balance.
//   Z_*, NEON_JETT : ERC-20 ↔ ERC-20 pools (standard transferFrom).
//   USDC_EURC, EURC_*  : populated by `DeployAndSeedEurcPools` once the
//                        deployer EOA holds EURC inventory on Arc Testnet.
//                        Until then, leave them at the zero address — the
//                        UI hides any pair without a registered pool.
// All pools use `ZilarcSwap` constant-product AMM with a 0.3% fee.
export const SWAP_POOLS = {
  // USDC native ↔ token AMM pools (precompile-side, real x*y=k pricing)
  USDC_Z:    "0xF620b9c807bF7Dc18B9Cc50f7833c90abD630187",
  USDC_NEON: "0xeDdbCd15aa35885fd078c93Ca2d9916D9A295305",
  USDC_JETT: "0x52CBe4119D29167a2bc57b4A7C618798928AF212",
  // Cross-token pools (200e18 / 200e18 seed)
  Z_NEON:    "0xb57449127d3B158aFcB23C81780789F1e169b224",
  Z_JETT:    "0xEEbBB08A86AA26cDAA50E12E7630b84D550b9042",
  NEON_JETT: "0xc411557A60Ce64B700Fe02fFbD4EeaEFE2af3F51",
  // EURC pools — deployed and seeded via DeployAndSeedEurcPools.s.sol
  // (4 units per side per pool, ~3.99 implied rate after 0.3% fee).
  USDC_EURC: "0x90F310c1a43AAC6c7991C20448Ca7E0Df23D6190",
  EURC_Z:    "0xE3AFAE18C17EC98f150Bdca434c10fe168069DAa",
  EURC_NEON: "0x7c6884B0ed8587d4DBC248e0207A768098b1d1CB",
  EURC_JETT: "0xB21657f9F7a4730FdD85CFA68E2F0c90c6d31BA2",
} as const;

// Legacy constant preserved for old call sites; points at the live USDC/Z pool.
export const SWAP_POOL_ADDRESS = SWAP_POOLS.USDC_Z as `0x${string}`;

// ZilarcRouter — single-call swap entrypoint over all AMM pools above.
// Accepts native USDC via msg.value, ERC-20 via approve+transferFrom, in one
// transaction. Update this after running `forge script DeployRouter`.
//
// Set `VITE_ZILARC_ROUTER` in your environment to override at build time.
export const ZILARC_ROUTER = (
  (import.meta.env.VITE_ZILARC_ROUTER as string | undefined) ??
  "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

// CCTP Domain IDs
export const CCTP_DOMAINS = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  base: 6,
  polygon: 7,
  linea: 15,
  arc: 26,
} as const;

export const config = createConfig({
  chains: [arcTestnet, sepolia, arbitrum, base, optimism, polygon, avalanche, linea],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Zilarc" }),
  ],
  transports: {
    [arcTestnet.id]: http(ARC_RPC_URL),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [linea.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}