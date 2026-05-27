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

// Token addresses on Arc Testnet
export const ARC_TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  Z: "0xdAca6186A7741d64C6bd7B33f918C46A52802c8A",
  NEON: "0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909",
  JETT: "0x404d8405753987E4f26e0E858fE5F5A1649ba35a",
} as const;

// Liquidity Pool addresses
export const SWAP_POOLS = {
  USDC_Z: "0x39cf4b39247063ab3eaaef3dbd3afc77114dcc63",
  USDC_NEON: "0x26Cb48F4C8e014604c4f890e88aB76ad9DDC64b8",
  USDC_JETT: "0x65aEBaD4E6FAE62ab67526131E66A903D5C025f7",
  // Cross-token pools
  Z_NEON: "0x9aa9c6d1E6a39e56E408B7b7d1644bD4c94A504f",
  Z_JETT: "0xe450fbb9935480e217D118639Ec6071e128dd2d2",
  NEON_JETT: "0x62cf458a17F023fC2Ff6A8b088339E8a1ADfeE8d",
} as const;

// Legacy single pool address (USDC-Z)
export const SWAP_POOL_ADDRESS = SWAP_POOLS.USDC_Z as `0x${string}`;

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